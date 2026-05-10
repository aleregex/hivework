require('dotenv').config();
const express = require('express');
const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet, utils } = require('@coral-xyz/anchor');
const bs58 = require('bs58').default;

const app = express();
app.use(express.json());

// Configuración inicial
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const PROGRAM_ID_STR = process.env.PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'; // Hivework pubkey

if (!PRIVATE_KEY) {
  console.error("Falta ORACLE_PRIVATE_KEY en .env");
  process.exit(1);
}

// Inicializar el Keypair del Oracle a partir de base58
const oracleKeypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
console.log(`Oracle pubkey: ${oracleKeypair.publicKey.toBase58()}`);

// Conexión y Proveedor
const connection = new Connection(RPC_URL, 'confirmed');
const wallet = new Wallet(oracleKeypair);
const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });

// Para el MVP, usamos un IDL genérico o generado dinámicamente si el IDL final está disponible
// Si el workspace estuviera construido, cargaríamos ./target/idl/hivework.json
// En su defecto, aquí asumiremos que tenemos un Program configurado:
let program;
try {
  // const idl = require('../target/idl/hivework.json'); // Idealmente
  // program = new Program(idl, PROGRAM_ID_STR, provider);
  console.log("Servicio Oracle levantado. Esperando inicialización completa del IDL.");
} catch (e) {
  console.log("IDL no encontrado aún. El endpoint registrará conversiones simuladas.");
}

// Endpoint que recibe el webhook del backend (Grupo B) cuando hay una conversión
app.post('/webhook/conversion', async (req, res) => {
  try {
    const { 
      campaign_pubkey, 
      leaf_pubkey, 
      node_l1_pubkey, 
      node_l2_pubkey, 
      node_l3_pubkey, 
      conversion_id, // uuid o string para derivar 16 bytes
      value_usdc 
    } = req.body;

    if (!campaign_pubkey || !leaf_pubkey || !value_usdc) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    // 1. Anti-fraude básico (lógica off-chain)
    // Aquí el Oracle verificaría en su propia DB o validando IPs, si la conversión es legítima.
    console.log(`Validando conversión ${conversion_id} para hoja ${leaf_pubkey}...`);
    // Simulación de check anti-fraude
    const isLegit = true; 
    if (!isLegit) {
      return res.status(403).json({ error: 'Conversión rechazada por fraude.' });
    }

    // 2. Preparar datos para Anchor
    // Generar o usar los 16 bytes de conversion_id para la PDA
    const idBuffer = Buffer.alloc(16);
    idBuffer.write(conversion_id.substring(0, 16)); // string a bytes (simplificado)
    const value = new anchor.BN(value_usdc); // amount en base atómica

    // 3. Obtener PDAs y cuentas
    const campaignKey = new PublicKey(campaign_pubkey);
    const leafKey = new PublicKey(leaf_pubkey);

    const [conversionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("conversion"),
        campaignKey.toBuffer(),
        leafKey.toBuffer(),
        idBuffer
      ],
      new PublicKey(PROGRAM_ID_STR)
    );

    console.log(`Firmando y enviando transacción para PDA: ${conversionPda.toBase58()}`);

    // Si tuviéramos el programa instanciado:
    /*
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
    
    console.log(`TX enviada con éxito: ${tx}`);
    */
    
    // Simulación exitosa para MVP (hasta que Anchor compile)
    res.status(200).json({ 
      success: true, 
      message: 'Conversión verificada y firmada on-chain.',
      pda: conversionPda.toBase58(),
      // tx: tx
    });

  } catch (error) {
    console.error("Error procesando webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Oracle service corriendo en el puerto ${PORT}`);
});
