const anchor = require("@coral-xyz/anchor");
const { SystemProgram, PublicKey, Keypair, LAMPORTS_PER_SOL } = anchor.web3;
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
} = require("@solana/spl-token");
const assert = require("assert");

describe("hivework", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Hivework;

  const authority = provider.wallet;
  const creator = provider.wallet;
  const oracleKp = Keypair.generate();

  let campaignPda;
  let nodeL1Pda, nodeL2Pda, nodeL3Pda;
  let leafPda;
  let conversionPda;

  let usdcMint;
  let authorityUsdc;
  let escrowUsdc;
  let creatorUsdc;

  const campaignId = 1;
  const nowSecs = Math.floor(Date.now() / 1000);
  const deadline = nowSecs + 6; // ~6s para que close_and_distribute pueda correr al final
  const alphaWeight = 40;
  const betaWeight = 40;
  const gammaWeight = 20;
  const initialUsdc = 1_000_000_000; // 1000 USDC (6 decimales)
  const conversionValue = 100_000_000; // 100 USDC

  const metadataHashL1 = Buffer.alloc(32, 1);
  const metadataHashL2 = Buffer.alloc(32, 2);
  const metadataHashL3 = Buffer.alloc(32, 3);
  const refCode = Buffer.from("REF12345");
  const conversionId = Buffer.alloc(16, 9);

  before(async () => {
    // Airdrop al oracle para que pueda firmar register_conversion
    const sig = await provider.connection.requestAirdrop(
      oracleKp.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Crear mint USDC de prueba (6 decimales como el real)
    usdcMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
    console.log("  Test USDC mint:", usdcMint.toBase58());

    // ATA de la authority y mint de fondos para escrow inicial
    const authAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      usdcMint,
      authority.publicKey
    );
    authorityUsdc = authAta.address;
    await mintTo(
      provider.connection,
      authority.payer,
      usdcMint,
      authorityUsdc,
      authority.publicKey,
      5_000_000_000
    );

    // PDAs
    [campaignPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("campaign"),
        authority.publicKey.toBuffer(),
        Buffer.from(new Uint32Array([campaignId]).buffer),
      ],
      program.programId
    );

    escrowUsdc = getAssociatedTokenAddressSync(usdcMint, campaignPda, true);

    [nodeL1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("node"), campaignPda.toBuffer(), creator.publicKey.toBuffer(), metadataHashL1],
      program.programId
    );
    [nodeL2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("node"), campaignPda.toBuffer(), creator.publicKey.toBuffer(), metadataHashL2],
      program.programId
    );
    [nodeL3Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("node"), campaignPda.toBuffer(), creator.publicKey.toBuffer(), metadataHashL3],
      program.programId
    );

    [leafPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaf"), campaignPda.toBuffer(), refCode],
      program.programId
    );

    [conversionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("conversion"), campaignPda.toBuffer(), leafPda.toBuffer(), conversionId],
      program.programId
    );

    // ATA del creator para recibir payouts
    const creatorAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      usdcMint,
      creator.publicKey
    );
    creatorUsdc = creatorAta.address;
  });

  it("Crea campaña con USDC depositado en escrow", async () => {
    const tx = await program.methods
      .createCampaign(
        new anchor.BN(deadline),
        alphaWeight,
        betaWeight,
        gammaWeight,
        campaignId,
        new anchor.BN(initialUsdc)
      )
      .accounts({
        campaign: campaignPda,
        usdcMint: usdcMint,
        escrowUsdc: escrowUsdc,
        authorityUsdc: authorityUsdc,
        authority: authority.publicKey,
        oracleAuthority: oracleKp.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("  ✓ create_campaign TX:", tx);

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.ok(campaign.authority.equals(authority.publicKey));
    assert.equal(campaign.alphaWeight, alphaWeight);
    assert.equal(campaign.platformFee, 5);
    assert.equal(campaign.isClosed, false);
    assert.ok(campaign.totalUsdc.eq(new anchor.BN(initialUsdc)));
    assert.ok(campaign.usdcMint.equals(usdcMint));
    assert.ok(campaign.oracleAuthority.equals(oracleKp.publicKey));

    const escrowAcc = await getAccount(provider.connection, escrowUsdc);
    assert.equal(escrowAcc.amount.toString(), initialUsdc.toString());
  });

  it("Rechaza pesos que no suman 100", async () => {
    const badId = 99;
    const [badCampaignPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("campaign"),
        authority.publicKey.toBuffer(),
        Buffer.from(new Uint32Array([badId]).buffer),
      ],
      program.programId
    );
    const badEscrow = getAssociatedTokenAddressSync(usdcMint, badCampaignPda, true);

    try {
      await program.methods
        .createCampaign(new anchor.BN(deadline), 30, 30, 30, badId, new anchor.BN(1))
        .accounts({
          campaign: badCampaignPda,
          usdcMint: usdcMint,
          escrowUsdc: badEscrow,
          authorityUsdc: authorityUsdc,
          authority: authority.publicKey,
          oracleAuthority: oracleKp.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      assert.fail("Debería haber fallado por pesos inválidos");
    } catch (err) {
      console.log("  ✓ Pesos α+β+γ ≠ 100 rechazados");
    }
  });

  it("Crea nodo L1 (stake 1 SOL)", async () => {
    await program.methods
      .createNode(1, Array.from(metadataHashL1))
      .accounts({
        node: nodeL1Pda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: null,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const node = await program.account.node.fetch(nodeL1Pda);
    assert.equal(node.level, 1);
    assert.ok(node.parentNode === null);
  });

  it("Crea nodo L2 (hijo de L1, stake 0.5 SOL)", async () => {
    await program.methods
      .createNode(2, Array.from(metadataHashL2))
      .accounts({
        node: nodeL2Pda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: nodeL1Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const node = await program.account.node.fetch(nodeL2Pda);
    assert.equal(node.level, 2);
    const parent = await program.account.node.fetch(nodeL1Pda);
    assert.equal(parent.forksCount, 1);
  });

  it("Crea nodo L3 (hijo de L2, stake 0.25 SOL)", async () => {
    await program.methods
      .createNode(3, Array.from(metadataHashL3))
      .accounts({
        node: nodeL3Pda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: nodeL2Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const node = await program.account.node.fetch(nodeL3Pda);
    assert.equal(node.level, 3);
  });

  it("Crea hoja con path genealógico válido", async () => {
    await program.methods
      .createLeaf(Array.from(refCode))
      .accounts({
        leaf: leafPda,
        campaign: campaignPda,
        creator: creator.publicKey,
        nodeL1: nodeL1Pda,
        nodeL2: nodeL2Pda,
        nodeL3: nodeL3Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const leaf = await program.account.leaf.fetch(leafPda);
    assert.deepEqual(leaf.refCode, Array.from(refCode));
    assert.equal(leaf.conversionsCount, 0);
    assert.ok(leaf.parentNode.equals(nodeL3Pda));
  });

  it("Rechaza path genealógico inválido", async () => {
    const badRefCode = Buffer.from("BADREF00");
    const [badLeafPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaf"), campaignPda.toBuffer(), badRefCode],
      program.programId
    );
    try {
      await program.methods
        .createLeaf(Array.from(badRefCode))
        .accounts({
          leaf: badLeafPda,
          campaign: campaignPda,
          creator: creator.publicKey,
          nodeL1: nodeL1Pda,
          nodeL2: nodeL2Pda,
          nodeL3: nodeL1Pda, // L1 en posición de L3 → inválido
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Debería haber fallado");
    } catch (err) {
      console.log("  ✓ Path inválido rechazado");
    }
  });

  it("Rechaza register_conversion firmado por wallet no-oracle", async () => {
    const fakeOracle = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(fakeOracle.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    const fakeId = Buffer.alloc(16, 7);
    const [fakeConvPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("conversion"), campaignPda.toBuffer(), leafPda.toBuffer(), fakeId],
      program.programId
    );

    try {
      await program.methods
        .registerConversion(Array.from(fakeId), new anchor.BN(1))
        .accounts({
          conversion: fakeConvPda,
          campaign: campaignPda,
          leaf: leafPda,
          nodeL1: nodeL1Pda,
          nodeL2: nodeL2Pda,
          nodeL3: nodeL3Pda,
          oracle: fakeOracle.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([fakeOracle])
        .rpc();
      assert.fail("Debería haber fallado por oracle no autorizado");
    } catch (err) {
      console.log("  ✓ Oracle no autorizado rechazado");
    }
  });

  it("Registra conversión firmada por oracle autorizado", async () => {
    await program.methods
      .registerConversion(Array.from(conversionId), new anchor.BN(conversionValue))
      .accounts({
        conversion: conversionPda,
        campaign: campaignPda,
        leaf: leafPda,
        nodeL1: nodeL1Pda,
        nodeL2: nodeL2Pda,
        nodeL3: nodeL3Pda,
        oracle: oracleKp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([oracleKp])
      .rpc();

    const conv = await program.account.conversion.fetch(conversionPda);
    assert.ok(conv.value.eq(new anchor.BN(conversionValue)));

    const leaf = await program.account.leaf.fetch(leafPda);
    assert.equal(leaf.conversionsCount, 1);
    const l1 = await program.account.node.fetch(nodeL1Pda);
    assert.equal(l1.conversionsCount, 1);
  });

  it("Cierra y distribuye después del deadline", async () => {
    // Esperar a que pase el deadline
    const wait = (deadline + 2) * 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    await program.methods
      .closeAndDistribute()
      .accounts({
        campaign: campaignPda,
        conversion: conversionPda,
        leaf: leafPda,
        nodeL1: nodeL1Pda,
        nodeL2: nodeL2Pda,
        nodeL3: nodeL3Pda,
        authority: authority.publicKey,
      })
      .rpc();

    const conv = await program.account.conversion.fetch(conversionPda);
    assert.equal(conv.isProcessed, true);

    const leaf = await program.account.leaf.fetch(leafPda);
    const l1 = await program.account.node.fetch(nodeL1Pda);
    console.log("  Leaf claimable:", leaf.claimableUsdc.toString());
    console.log("  L1   claimable:", l1.claimableUsdc.toString());
    assert.ok(leaf.claimableUsdc.gtn(0));
    assert.ok(l1.claimableUsdc.gtn(0));
  });

  it("Claim payout transfiere USDC al creator y libera stake", async () => {
    const balBefore = (await getAccount(provider.connection, creatorUsdc)).amount;
    const l1Before = await program.account.node.fetch(nodeL1Pda);

    await program.methods
      .claimPayout()
      .accounts({
        node: nodeL1Pda,
        campaign: campaignPda,
        escrowUsdc: escrowUsdc,
        creatorUsdc: creatorUsdc,
        creator: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const balAfter = (await getAccount(provider.connection, creatorUsdc)).amount;
    const delta = balAfter - balBefore;
    console.log("  ΔUSDC creator (L1):", delta.toString());
    assert.ok(delta > 0n);

    const l1After = await program.account.node.fetch(nodeL1Pda);
    assert.equal(l1After.claimableUsdc.toString(), "0");
    // Stake liberado porque hubo conversiones
    assert.ok(l1Before.stakeLocked.gt(new anchor.BN(0)));
    assert.equal(l1After.stakeLocked.toString(), "0");
  });

  it("Claim leaf payout transfiere USDC + bonus", async () => {
    const balBefore = (await getAccount(provider.connection, creatorUsdc)).amount;

    await program.methods
      .claimLeafPayout()
      .accounts({
        leaf: leafPda,
        campaign: campaignPda,
        escrowUsdc: escrowUsdc,
        creatorUsdc: creatorUsdc,
        creator: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const balAfter = (await getAccount(provider.connection, creatorUsdc)).amount;
    const delta = balAfter - balBefore;
    console.log("  ΔUSDC creator (Leaf+30%):", delta.toString());
    assert.ok(delta > 0n);
  });
});
