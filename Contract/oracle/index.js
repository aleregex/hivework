require('dotenv').config();
const express = require('express');
const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet, BN } = require('@coral-xyz/anchor');
const bs58 = require('bs58').default;
const path = require('path');

const app = express();
app.use(express.json());

// Configuración
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const PROGRAM_ID_STR = process.env.PROGRAM_ID;

if (!PRIVATE_KEY) {
  console.error("Falta ORACLE_PRIVATE_KEY en .env");
  process.exit(1);
}

// Keypair del Oracle
const oracleKeypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
console.log(`Oracle pubkey: ${oracleKeypair.publicKey.toBase58()}`);

// Conexión y Provider
const connection = new Connection(RPC_URL, 'confirmed');
const wallet = new Wallet(oracleKeypair);
const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });

// Cargar IDL y crear instancia del programa
let program;
try {
  const idl = require('../target/idl/hivework.json');
  const programId = new PublicKey(PROGRAM_ID_STR || idl.address);
  program = new Program(idl, provider);
  console.log(`Programa cargado: ${programId.toBase58()}`);
} catch (e) {
  console.error("Error cargando IDL:", e.message);
  console.log("Asegúrate de haber corrido 'anchor build' primero.");
}

// Anti-fraude básico: rate limiting por IP y wallet
const recentConversions = new Map(); // key: wallet+campaign, value: timestamp
const RATE_LIMIT_MS = 30_000; // 30 segundos entre conversiones de la misma wallet

function isLegitimate(walletPubkey, campaignPubkey, ip) {
  const key = `${walletPubkey}-${campaignPubkey}`;
  const now = Date.now();
  const last = recentConversions.get(key);

  if (last && (now - last) < RATE_LIMIT_MS) {
    console.log(`Rate limit: ${key} intentó demasiado rápido`);
    return false;
  }

  recentConversions.set(key, now);
  return true;
}

// POST /webhook/conversion — Grupo B envía aquí las conversiones
app.post('/webhook/conversion', async (req, res) => {
  try {
    const {
      campaign_pubkey,
      leaf_pubkey,
      node_l1_pubkey,
      node_l2_pubkey,
      node_l3_pubkey,
      conversion_id, // string de 16 chars
      value_usdc,
      wallet_address
    } = req.body;

    if (!campaign_pubkey || !leaf_pubkey || !value_usdc || !conversion_id) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    // Anti-fraude
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!isLegitimate(wallet_address || leaf_pubkey, campaign_pubkey, clientIp)) {
      return res.status(429).json({ error: 'Rate limit: conversión demasiado frecuente.' });
    }

    if (!program) {
      return res.status(503).json({ error: 'Programa no inicializado. IDL no cargado.' });
    }

    // Preparar datos
    const idBuffer = Buffer.alloc(16);
    idBuffer.write(conversion_id.substring(0, 16));
    const value = new BN(value_usdc);

    const campaignKey = new PublicKey(campaign_pubkey);
    const leafKey = new PublicKey(leaf_pubkey);

    const [conversionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("conversion"),
        campaignKey.toBuffer(),
        leafKey.toBuffer(),
        idBuffer
      ],
      program.programId
    );

    console.log(`Firmando conversión ${conversion_id} → PDA: ${conversionPda.toBase58()}`);

    // Enviar transacción al contrato
    const tx = await program.methods.registerConversion(Array.from(idBuffer), value)
      .accounts({
        conversion: conversionPda,
        campaign: campaignKey,
        leaf: leafKey,
        nodeL1: new PublicKey(node_l1_pubkey),
        nodeL2: new PublicKey(node_l2_pubkey),
        nodeL3: new PublicKey(node_l3_pubkey),
        oracle: oracleKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([oracleKeypair])
      .rpc();

    console.log(`TX exitosa: ${tx}`);

    res.status(200).json({
      success: true,
      message: 'Conversión registrada on-chain.',
      tx,
      pda: conversionPda.toBase58(),
    });

  } catch (error) {
    console.error("Error procesando webhook:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    oracle: oracleKeypair.publicKey.toBase58(),
    program: program ? program.programId.toBase58() : 'not loaded',
  });
});

app.listen(PORT, () => {
  console.log(`Oracle corriendo en puerto ${PORT}`);
});
