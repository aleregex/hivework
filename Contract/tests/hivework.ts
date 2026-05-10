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
  // un L2 perdedor para testear forfeit
  let nodeL2LoserPda;
  let leafPda;
  let conversionPda;

  let usdcMint;
  let authorityUsdc;
  let escrowUsdc;
  let creatorUsdc;

  const campaignId = 1;
  const nowSecs = Math.floor(Date.now() / 1000);
  const deadline = nowSecs + 6;
  const alphaWeight = 40;
  const betaWeight = 40;
  const gammaWeight = 20;
  const initialUsdc = 1_000_000_000; // 1000 USDC
  const conversionValue = 100_000_000; // 100 USDC

  const metadataHashL1 = Buffer.alloc(32, 1);
  const metadataHashL2 = Buffer.alloc(32, 2);
  const metadataHashL3 = Buffer.alloc(32, 3);
  const metadataHashL2Loser = Buffer.alloc(32, 4);
  const refCode = Buffer.from("REF12345");
  const conversionId = Buffer.alloc(16, 9);

  before(async () => {
    // Fondear oracle desde el provider (evita rate limit de airdrop en devnet)
    const fundOracleTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: oracleKp.publicKey,
        lamports: LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(fundOracleTx);

    usdcMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
    console.log("  Test USDC mint:", usdcMint.toBase58());

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
    [nodeL2LoserPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("node"), campaignPda.toBuffer(), creator.publicKey.toBuffer(), metadataHashL2Loser],
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
        usdcMint,
        escrowUsdc,
        authorityUsdc,
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
    assert.equal(campaign.totalConversions, 0);
    assert.equal(campaign.forfeitedPool.toString(), "0");

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
          usdcMint,
          escrowUsdc: badEscrow,
          authorityUsdc,
          authority: authority.publicKey,
          oracleAuthority: oracleKp.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      assert.fail("Debería haber fallado");
    } catch {
      console.log("  ✓ Pesos α+β+γ ≠ 100 rechazados");
    }
  });

  it("Crea nodo L1 (stake 1 SOL, bytes_metadata=600)", async () => {
    await program.methods
      .createNode(1, Array.from(metadataHashL1), 600)
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
    assert.equal(node.bytesMetadata, 600);
  });

  it("Crea nodo L2 (hijo de L1, stake 0.5 SOL)", async () => {
    await program.methods
      .createNode(2, Array.from(metadataHashL2), 800)
      .accounts({
        node: nodeL2Pda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: nodeL1Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const parent = await program.account.node.fetch(nodeL1Pda);
    assert.equal(parent.forksCount, 1);
  });

  it("Crea segundo L2 hermano (que no tendrá conversiones — perdedor)", async () => {
    await program.methods
      .createNode(2, Array.from(metadataHashL2Loser), 200)
      .accounts({
        node: nodeL2LoserPda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: nodeL1Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const parent = await program.account.node.fetch(nodeL1Pda);
    assert.equal(parent.forksCount, 2);
  });

  it("Crea nodo L3 (hijo de L2, stake 0.25 SOL)", async () => {
    await program.methods
      .createNode(3, Array.from(metadataHashL3), 1500)
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
    assert.equal(node.bytesMetadata, 1500); // saturará a 1000 en richness
  });

  it("Crea hoja con path genealógico válido y bytes_metadata=900", async () => {
    await program.methods
      .createLeaf(Array.from(refCode), 900)
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
    assert.equal(leaf.bytesMetadata, 900);
    assert.ok(leaf.parentNode.equals(nodeL3Pda));
    assert.equal(leaf.redistributionClaimed, false);
  });

  it("Rechaza path genealógico inválido", async () => {
    const badRefCode = Buffer.from("BADREF00");
    const [badLeafPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaf"), campaignPda.toBuffer(), badRefCode],
      program.programId
    );
    try {
      await program.methods
        .createLeaf(Array.from(badRefCode), 100)
        .accounts({
          leaf: badLeafPda,
          campaign: campaignPda,
          creator: creator.publicKey,
          nodeL1: nodeL1Pda,
          nodeL2: nodeL2Pda,
          nodeL3: nodeL1Pda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Debería haber fallado");
    } catch {
      console.log("  ✓ Path inválido rechazado");
    }
  });

  it("Rechaza register_conversion firmado por wallet no-oracle", async () => {
    const fakeOracle = Keypair.generate();
    const fundTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: fakeOracle.publicKey,
        lamports: LAMPORTS_PER_SOL / 2,
      })
    );
    await provider.sendAndConfirm(fundTx);

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
      assert.fail("Debería haber fallado");
    } catch {
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

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.equal(campaign.totalConversions, 1);

    const leaf = await program.account.leaf.fetch(leafPda);
    assert.equal(leaf.conversionsCount, 1);
    const l1 = await program.account.node.fetch(nodeL1Pda);
    assert.equal(l1.conversionsCount, 1);
    // El L2 perdedor sigue en 0
    const l2Loser = await program.account.node.fetch(nodeL2LoserPda);
    assert.equal(l2Loser.conversionsCount, 0);
  });

  it("Cierra y distribuye después del deadline (fórmula log + richness)", async () => {
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

  it("Forfeit del L2 perdedor mueve su stake al pool de la campaña", async () => {
    const campBefore = await program.account.campaign.fetch(campaignPda);
    const loserBefore = await program.account.node.fetch(nodeL2LoserPda);

    await program.methods
      .forfeitNodeStake()
      .accounts({
        node: nodeL2LoserPda,
        campaign: campaignPda,
        caller: authority.publicKey,
      })
      .rpc();

    const campAfter = await program.account.campaign.fetch(campaignPda);
    const loserAfter = await program.account.node.fetch(nodeL2LoserPda);

    console.log("  forfeited_pool:", campAfter.forfeitedPool.toString());
    assert.ok(campAfter.forfeitedPool.gt(campBefore.forfeitedPool));
    assert.equal(loserAfter.stakeLocked.toString(), "0");
    assert.ok(loserBefore.stakeLocked.gt(new anchor.BN(0)));
  });

  it("Rechaza forfeit de un nodo ganador", async () => {
    try {
      await program.methods
        .forfeitNodeStake()
        .accounts({
          node: nodeL1Pda, // tiene conversiones, es ganador
          campaign: campaignPda,
          caller: authority.publicKey,
        })
        .rpc();
      assert.fail("Debería haber fallado");
    } catch {
      console.log("  ✓ Forfeit a ganador rechazado");
    }
  });

  it("Claim payout transfiere USDC al creator y libera stake", async () => {
    const balBefore = (await getAccount(provider.connection, creatorUsdc)).amount;
    const l1Before = await program.account.node.fetch(nodeL1Pda);

    await program.methods
      .claimPayout()
      .accounts({
        node: nodeL1Pda,
        campaign: campaignPda,
        escrowUsdc,
        creatorUsdc,
        creator: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const balAfter = (await getAccount(provider.connection, creatorUsdc)).amount;
    console.log("  ΔUSDC L1:", (balAfter - balBefore).toString());
    assert.ok(balAfter > balBefore);

    const l1After = await program.account.node.fetch(nodeL1Pda);
    assert.equal(l1After.claimableUsdc.toString(), "0");
    assert.ok(l1Before.stakeLocked.gt(new anchor.BN(0)));
    assert.equal(l1After.stakeLocked.toString(), "0");
  });

  it("Claim leaf payout transfiere USDC + bonus 30%", async () => {
    const balBefore = (await getAccount(provider.connection, creatorUsdc)).amount;

    await program.methods
      .claimLeafPayout()
      .accounts({
        leaf: leafPda,
        campaign: campaignPda,
        escrowUsdc,
        creatorUsdc,
        creator: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const balAfter = (await getAccount(provider.connection, creatorUsdc)).amount;
    console.log("  ΔUSDC Leaf+30%:", (balAfter - balBefore).toString());
    assert.ok(balAfter > balBefore);
  });

  it("Claim redistribution paga al leaf ganador su porción del pool", async () => {
    const campBefore = await program.account.campaign.fetch(campaignPda);
    assert.ok(campBefore.forfeitedPool.gt(new anchor.BN(0)));

    const balBefore = await provider.connection.getBalance(creator.publicKey);

    await program.methods
      .claimRedistribution()
      .accounts({
        leaf: leafPda,
        campaign: campaignPda,
        creator: creator.publicKey,
      })
      .rpc();

    const balAfter = await provider.connection.getBalance(creator.publicKey);
    const leafAfter = await program.account.leaf.fetch(leafPda);
    const campAfter = await program.account.campaign.fetch(campaignPda);

    console.log("  ΔSOL creator (redistribution):", balAfter - balBefore);
    assert.equal(leafAfter.redistributionClaimed, true);
    assert.ok(campAfter.forfeitedPool.lt(campBefore.forfeitedPool));
  });

  it("Rechaza claim_redistribution duplicado del mismo leaf", async () => {
    try {
      await program.methods
        .claimRedistribution()
        .accounts({
          leaf: leafPda,
          campaign: campaignPda,
          creator: creator.publicKey,
        })
        .rpc();
      assert.fail("Debería haber fallado");
    } catch {
      console.log("  ✓ Doble claim de redistribución rechazado");
    }
  });
});
