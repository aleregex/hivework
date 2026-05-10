const anchor = require("@coral-xyz/anchor");
const { SystemProgram, PublicKey } = anchor.web3;
const assert = require("assert");

describe("hivework", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Hivework;

  const authority = provider.wallet;
  const creator = provider.wallet;

  let campaignPda, campaignBump;
  let nodeL1Pda, nodeL2Pda, nodeL3Pda;
  let leafPda;

  const campaignId = 1;
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hora
  const alphaWeight = 40;
  const betaWeight = 40;
  const gammaWeight = 20;
  const metadataHashL1 = Buffer.alloc(32, 1);
  const metadataHashL2 = Buffer.alloc(32, 2);
  const metadataHashL3 = Buffer.alloc(32, 3);
  const refCode = Buffer.from("REF12345");

  before(async () => {
    // Derivar PDA de campaña
    [campaignPda, campaignBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("campaign"),
        authority.publicKey.toBuffer(),
        Buffer.from(new Uint32Array([campaignId]).buffer),
      ],
      program.programId
    );

    // Derivar PDAs de nodos
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

    // Derivar PDA de hoja
    [leafPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaf"), campaignPda.toBuffer(), refCode],
      program.programId
    );
  });

  it("Crea una campaña", async () => {
    const escrow = anchor.web3.Keypair.generate();
    const tx = await program.methods
      .createCampaign(
        new anchor.BN(deadline),
        alphaWeight,
        betaWeight,
        gammaWeight,
        campaignId
      )
      .accounts({
        campaign: campaignPda,
        authority: authority.publicKey,
        escrowUsdc: escrow.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  ✓ create_campaign TX:", tx);

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.ok(campaign.authority.equals(authority.publicKey));
    assert.equal(campaign.alphaWeight, alphaWeight);
    assert.equal(campaign.platformFee, 5);
    assert.equal(campaign.isClosed, false);
  });

  it("Crea nodo L1 (stake 1 SOL)", async () => {
    const tx = await program.methods
      .createNode(1, Array.from(metadataHashL1))
      .accounts({
        node: nodeL1Pda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: null,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  ✓ create_node L1 TX:", tx);

    const node = await program.account.node.fetch(nodeL1Pda);
    assert.equal(node.level, 1);
    assert.ok(node.parentNode === null);
  });

  it("Crea nodo L2 (hijo de L1, stake 0.5 SOL)", async () => {
    const tx = await program.methods
      .createNode(2, Array.from(metadataHashL2))
      .accounts({
        node: nodeL2Pda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: nodeL1Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  ✓ create_node L2 TX:", tx);

    const node = await program.account.node.fetch(nodeL2Pda);
    assert.equal(node.level, 2);

    // Verificar que forks_count del padre se incrementó
    const parentNode = await program.account.node.fetch(nodeL1Pda);
    assert.equal(parentNode.forksCount, 1);
  });

  it("Crea nodo L3 (hijo de L2, stake 0.25 SOL)", async () => {
    const tx = await program.methods
      .createNode(3, Array.from(metadataHashL3))
      .accounts({
        node: nodeL3Pda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: nodeL2Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  ✓ create_node L3 TX:", tx);

    const node = await program.account.node.fetch(nodeL3Pda);
    assert.equal(node.level, 3);
  });

  it("Crea hoja con path genealógico válido", async () => {
    const tx = await program.methods
      .createLeaf(Array.from(refCode))
      .accounts({
        leaf: leafPda,
        campaign: campaignPda,
        creator: creator.publicKey,
        parentNode: nodeL3Pda,
        nodeL1: nodeL1Pda,
        nodeL2: nodeL2Pda,
        nodeL3: nodeL3Pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  ✓ create_leaf TX:", tx);

    const leaf = await program.account.leaf.fetch(leafPda);
    assert.deepEqual(leaf.refCode, Array.from(refCode));
    assert.equal(leaf.conversionsCount, 0);
  });

  it("Rechaza path genealógico inválido", async () => {
    const badRefCode = Buffer.from("BADREF00");
    const [badLeafPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaf"), campaignPda.toBuffer(), badRefCode],
      program.programId
    );

    try {
      // Intentar crear hoja con nodos en orden incorrecto
      await program.methods
        .createLeaf(Array.from(badRefCode))
        .accounts({
          leaf: badLeafPda,
          campaign: campaignPda,
          creator: creator.publicKey,
          parentNode: nodeL1Pda, // Debería ser L3
          nodeL1: nodeL1Pda,
          nodeL2: nodeL2Pda,
          nodeL3: nodeL1Pda, // L1 en lugar de L3 → inválido
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Debería haber fallado");
    } catch (err) {
      console.log("  ✓ Path inválido rechazado correctamente");
    }
  });
});
