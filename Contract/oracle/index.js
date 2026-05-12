require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet, BN } = require('@coral-xyz/anchor');
// bs58 v5 exports differently across CJS/ESM resolutions — use `.default` if
// present, otherwise the module itself. Works on Node 18, 22, and 24.
const bs58 = require('bs58').default || require('bs58');

const app = express();
app.use(express.json());
app.set('trust proxy', true); // confiar en X-Forwarded-For si está detrás de proxy

const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PRIVATE_KEY_BS58 = process.env.ORACLE_PRIVATE_KEY;
const KEYPAIR_PATH = process.env.ORACLE_KEYPAIR_PATH;
const PROGRAM_ID_STR = process.env.PROGRAM_ID;
// Endpoint de B para verificar conversiones contra metadata off-chain.
// Spec grupo_a.md: "Endpoint que el oracle llama para verificar potenciales
// conversiones contra la metadata off-chain antes de firmar".
// Si está vacío, el oracle confía en el webhook directo (modo demo).
const BACKEND_VERIFY_URL = process.env.BACKEND_VERIFY_URL || '';
// Bearer token requerido en el header Authorization para aceptar webhooks.
// Si se define, el API debe enviarlo en ORACLE_WEBHOOK_TOKEN para que coincida.
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || '';

// Cargar keypair: prioridad ORACLE_KEYPAIR_PATH (formato JSON solana) > ORACLE_PRIVATE_KEY (base58)
function loadKeypair() {
  if (KEYPAIR_PATH) {
    const resolved = path.resolve(KEYPAIR_PATH);
    if (!fs.existsSync(resolved)) {
      console.error(`ORACLE_KEYPAIR_PATH apunta a ${resolved} pero no existe.`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  if (PRIVATE_KEY_BS58) {
    return Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY_BS58));
  }
  console.error("Falta ORACLE_KEYPAIR_PATH o ORACLE_PRIVATE_KEY en .env");
  process.exit(1);
}

const oracleKeypair = loadKeypair();
console.log(`Oracle pubkey: ${oracleKeypair.publicKey.toBase58()}`);

const connection = new Connection(RPC_URL, 'confirmed');

// Surface the oracle wallet's SOL balance at boot so missing-funds bugs are
// obvious. "Attempt to debit an account but found no record of a prior credit"
// is almost always this: the oracle pays tx fees and needs devnet SOL.
connection.getBalance(oracleKeypair.publicKey).then(
  (lamports) => {
    const sol = (lamports / 1e9).toFixed(4);
    console.log(`[oracle] saldo del fee-payer: ${sol} SOL (${lamports} lamports) en ${RPC_URL}`);
    if (lamports === 0) {
      console.warn(
        `[oracle] ⚠️  El oracle tiene 0 SOL. Fundealo con:\n` +
          `         solana airdrop 2 ${oracleKeypair.publicKey.toBase58()} --url devnet`
      );
    }
  },
  (err) => console.warn(`[oracle] no pude leer saldo: ${err.message}`)
);
const wallet = new Wallet(oracleKeypair);
const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });

let program;
try {
  const idl = require('../idl/hivework.json');
  const programId = new PublicKey(PROGRAM_ID_STR || idl.address);
  program = new Program(idl, provider);
  console.log(`Programa cargado: ${programId.toBase58()}`);
} catch (e) {
  console.error("Error cargando IDL:", e.message);
  console.log("Asegúrate de haber corrido 'anchor build' primero.");
}

// ---- Anti-fraude básico (spec grupo_a.md) ---------------------------------
// 1. Verificación de wallet: pubkey base58 válida (32 bytes)
// 2. IP no duplicada: misma IP no puede registrar > N conversiones en M segundos
// 3. Timing razonable: misma wallet+campaign no puede repetir en < 30s
const RATE_WALLET_MS = 30_000;          // ventana por wallet+campaign
const RATE_IP_MS     = 5_000;           // ventana entre conversiones de la misma IP
const IP_BURST_MAX   = 5;               // máx. 5 conversiones por IP en 60s
const IP_BURST_WINDOW = 60_000;

const lastByWallet = new Map(); // key: wallet|campaign → timestamp
const lastByIp     = new Map(); // key: ip → timestamp
const ipBucket     = new Map(); // key: ip → array de timestamps

function isValidPubkey(s) {
  if (typeof s !== 'string') return false;
  try { new PublicKey(s); return true; } catch { return false; }
}

function isLegitimate({ walletPubkey, campaignPubkey, ip }) {
  const now = Date.now();

  // Filtro 1: timing por wallet+campaign
  if (walletPubkey) {
    const walletKey = `${walletPubkey}|${campaignPubkey}`;
    const last = lastByWallet.get(walletKey);
    if (last && (now - last) < RATE_WALLET_MS) {
      return { ok: false, reason: `wallet rate limit (${Math.ceil((RATE_WALLET_MS - (now - last)) / 1000)}s)` };
    }
    lastByWallet.set(walletKey, now);
  }

  // Filtro 2: misma IP no demasiado seguido
  if (ip) {
    const last = lastByIp.get(ip);
    if (last && (now - last) < RATE_IP_MS) {
      return { ok: false, reason: 'ip rate limit (intervalo)' };
    }
    lastByIp.set(ip, now);

    // Filtro 3: ráfaga por IP (máx N en ventana M)
    const arr = (ipBucket.get(ip) || []).filter(t => now - t < IP_BURST_WINDOW);
    if (arr.length >= IP_BURST_MAX) {
      return { ok: false, reason: 'ip rate limit (ráfaga)' };
    }
    arr.push(now);
    ipBucket.set(ip, arr);
  }

  return { ok: true };
}

app.post('/webhook/conversion', async (req, res) => {
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[oracle][${reqId}] webhook recibido`, {
    conversion_id: req.body?.conversion_id,
    leaf: req.body?.leaf_pubkey,
    campaign: req.body?.campaign_pubkey,
    value_usdc: req.body?.value_usdc,
    buyer: req.body?.wallet_address,
    ip: req.ip,
  });
  try {
    // Bearer-token guard. Habilitado solo cuando WEBHOOK_TOKEN está definido.
    if (WEBHOOK_TOKEN) {
      const auth = req.headers['authorization'] || '';
      const expected = `Bearer ${WEBHOOK_TOKEN}`;
      if (auth !== expected) {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }

    const {
      campaign_pubkey,
      leaf_pubkey,
      node_l1_pubkey,
      node_l2_pubkey,
      node_l3_pubkey,
      conversion_id,   // string de hasta 16 chars
      value_usdc,
      wallet_address,  // wallet del comprador (opcional pero recomendado)
    } = req.body;

    // Validación de wallet (spec: anti-fraude)
    for (const [name, val] of [
      ['campaign_pubkey', campaign_pubkey],
      ['leaf_pubkey', leaf_pubkey],
      ['node_l1_pubkey', node_l1_pubkey],
      ['node_l2_pubkey', node_l2_pubkey],
      ['node_l3_pubkey', node_l3_pubkey],
    ]) {
      if (!isValidPubkey(val)) return res.status(400).json({ error: `${name} no es una pubkey válida` });
    }
    if (wallet_address && !isValidPubkey(wallet_address)) {
      return res.status(400).json({ error: 'wallet_address no es una pubkey válida' });
    }
    if (typeof conversion_id !== 'string' || conversion_id.length === 0) {
      return res.status(400).json({ error: 'conversion_id requerido (string)' });
    }
    if (typeof value_usdc !== 'number' && typeof value_usdc !== 'string') {
      return res.status(400).json({ error: 'value_usdc requerido' });
    }

    const ip = req.ip || req.connection.remoteAddress;
    const guard = isLegitimate({
      walletPubkey: wallet_address || leaf_pubkey,
      campaignPubkey: campaign_pubkey,
      ip,
    });
    if (!guard.ok) {
      return res.status(429).json({ error: `Anti-fraude: ${guard.reason}` });
    }

    // Verificación cruzada con backend de B antes de firmar
    if (BACKEND_VERIFY_URL) {
      try {
        const u = new URL(BACKEND_VERIFY_URL);
        u.searchParams.set('conversion_id', conversion_id);
        u.searchParams.set('leaf_pubkey', leaf_pubkey);
        u.searchParams.set('campaign_pubkey', campaign_pubkey);
        const r = await fetch(u.toString(), { method: 'GET' });
        if (!r.ok) {
          return res.status(409).json({ error: `Backend rechaza conversión: ${r.status}` });
        }
        const verified = await r.json();
        if (verified && verified.valid === false) {
          return res.status(409).json({ error: `Backend rechaza conversión: ${verified.reason || 'invalid'}` });
        }
      } catch (e) {
        return res.status(502).json({ error: `Falló verificación con backend: ${e.message}` });
      }
    }

    if (!program) {
      return res.status(503).json({ error: 'Programa no inicializado. IDL no cargado.' });
    }

    const idBuffer = Buffer.alloc(16);
    idBuffer.write(conversion_id.substring(0, 16));
    const value = new BN(value_usdc);

    const campaignKey = new PublicKey(campaign_pubkey);
    const leafKey = new PublicKey(leaf_pubkey);

    const [conversionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("conversion"), campaignKey.toBuffer(), leafKey.toBuffer(), idBuffer],
      program.programId
    );

    console.log(`[oracle][${reqId}] firmando conversión`, {
      conversion_id,
      conversion_pda: conversionPda.toBase58(),
      campaign: campaignKey.toBase58(),
      leaf: leafKey.toBase58(),
      node_l1: node_l1_pubkey,
      node_l2: node_l2_pubkey,
      node_l3: node_l3_pubkey,
      fee_payer: oracleKeypair.publicKey.toBase58(),
      value_usdc: value.toString(),
    });

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

    console.log(`[oracle][${reqId}] tx exitosa: ${tx}`);

    res.status(200).json({
      success: true,
      message: 'Conversión registrada on-chain.',
      tx,
      pda: conversionPda.toBase58(),
    });
  } catch (error) {
    console.error(`[oracle][${reqId}] error procesando webhook:`, error.message);
    // SendTransactionError carga logs detallados que el .message oculta. Si
    // están disponibles los volcamos para diagnosticar el revert real (e.g.
    // "Attempt to debit an account ..." = fee-payer sin SOL).
    if (typeof error.getLogs === 'function') {
      try {
        const logs = await error.getLogs(connection);
        console.error(`[oracle][${reqId}] logs on-chain:`, logs);
      } catch (logErr) {
        console.error(`[oracle][${reqId}] no pude leer logs:`, logErr.message);
      }
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    oracle: oracleKeypair.publicKey.toBase58(),
    program: program ? program.programId.toBase58() : 'not loaded',
    rpc: RPC_URL,
  });
});

app.listen(PORT, () => {
  console.log(`Oracle corriendo en puerto ${PORT}`);
});
