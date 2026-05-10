# Hivework — Guía de integración para B y C

Este documento es lo que el spec `docs/grupo_a.md` exige entregar a los demás grupos:

- IDL del programa (en `Contract/idl/hivework.json`)
- Lista de eventos con sus campos exactos (sección 3)
- Pubkey del programa deployado en devnet (sección 1)
- Especificación clara de cómo firmar conversiones desde el oracle (sección 4)
- Ejemplos de transacciones serializadas para crear campaña, crear nodo, crear hoja, claim payout (sección 5)
- Lista de errores custom con códigos y mensajes claros (sección 6)

---

## 1. Identificadores

| Item | Valor |
|---|---|
| Program ID (devnet) | `8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8` |
| Oracle pubkey autorizado | `FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU` |
| Cluster | devnet (`https://api.devnet.solana.com`) |
| IDL path | `Contract/idl/hivework.json` |

---

## 2. Seeds de PDAs (para que B y C puedan derivarlas off-chain)

Todas las strings se codifican como UTF-8.

| Cuenta | Seeds |
|---|---|
| `Campaign` | `[b"campaign", authority_pubkey, campaign_id_le_u32]` |
| `Node` | `[b"node", campaign_pubkey, creator_pubkey, metadata_hash_32]` |
| `Leaf` | `[b"leaf", campaign_pubkey, ref_code_8]` |
| `Conversion` | `[b"conversion", campaign_pubkey, leaf_pubkey, conversion_id_16]` |
| `Escrow USDC` | ATA derivada de `(usdc_mint, campaign_pubkey)` con `allowOwnerOffCurve=true` |

`campaign_id_le_u32`: `u32` little-endian (4 bytes). `ref_code_8`: `[u8; 8]` ASCII. `conversion_id_16`: `[u8; 16]` arbitrarios.

---

## 3. Eventos emitidos por el programa

El indexer de B debe escuchar estos eventos vía `getProgramAccounts` o subscriptions:

```rust
CampaignCreated     { campaign: Pubkey, authority: Pubkey, total_usdc: u64, deadline: i64 }
NodeCreated         { node: Pubkey, campaign: Pubkey, creator: Pubkey, level: u8 }
LeafCreated         { leaf: Pubkey, campaign: Pubkey, creator: Pubkey, ref_code: [u8;8] }
ConversionRegistered{ conversion: Pubkey, campaign: Pubkey, leaf: Pubkey, value: u64 }
CampaignClosed      { campaign: Pubkey, conversions_processed: u32 }
```

Los logs aparecen como `Program log: Instruction: <name>` seguidos de `Program data: <base64>` con los bytes del evento.

---

## 4. Cómo firmar conversiones desde el oracle (spec para B)

**No hay un esquema de firma offline custom.** El programa Anchor identifica al oracle autorizado vía la constraint:

```rust
#[account(address = campaign.oracle_authority @ HiveworkError::UnauthorizedOracle)]
pub oracle: Signer<'info>,
```

Es decir, la "firma" es la firma estándar Ed25519 que Solana requiere para CUALQUIER signer en una transacción. El oracle no firma un payload separado; firma la transacción que llama `register_conversion`.

**Flujo:**

1. B genera `conversion_id` (16 bytes, idealmente UUID v4 raw).
2. B hace POST al oracle service: `/webhook/conversion` con el payload (sección 7).
3. El oracle valida (anti-fraude IP/wallet/timing) y **opcionalmente** llama a `BACKEND_VERIFY_URL` para que B confirme contra su propia base de datos.
4. El oracle construye y firma la transacción Anchor que llama `register_conversion`, usando la keypair en `indexer/oracle.json` (que es el mismo pubkey almacenado en `campaign.oracle_authority`).
5. El programa rechaza la transacción si `oracle.key() != campaign.oracle_authority`.

**Bytes que se firman:** la transacción Solana completa (header + message + signers). Algoritmo: Ed25519 standard de Solana. No hay nada custom.

---

## 5. Ejemplos de transacciones (TypeScript con Anchor)

```ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const PROGRAM_ID = new PublicKey("8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8");
const ORACLE_PUBKEY = new PublicKey("FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU");

// --- 5.1 Crear campaña ---------------------------------------------------
async function createCampaign(program, brand, usdcMint, brandUsdcAta) {
  const campaignId = Math.floor(Date.now() / 1000); // u32
  const [campaignPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), brand.publicKey.toBuffer(),
     Buffer.from(new Uint32Array([campaignId]).buffer)],
    PROGRAM_ID
  );
  const escrowAta = getAssociatedTokenAddressSync(usdcMint, campaignPda, true);

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const initialUsdc = new anchor.BN(1_000_000_000); // 1000 USDC (6 dec)

  return await program.methods
    .createCampaign(new anchor.BN(deadline), 40, 40, 20, campaignId, initialUsdc)
    .accounts({
      campaign: campaignPda,
      usdcMint,
      escrowUsdc: escrowAta,
      authorityUsdc: brandUsdcAta,
      authority: brand.publicKey,
      oracleAuthority: ORACLE_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([brand])
    .rpc();
}

// --- 5.2 Crear nodo (L1) -------------------------------------------------
async function createNodeL1(program, creator, campaignPda, metadataJson) {
  const metadataBytes = Buffer.from(JSON.stringify(metadataJson));
  const metadataHash = require("crypto").createHash("sha256")
    .update(metadataBytes).digest();
  const bytesMetadata = metadataBytes.length;

  const [nodePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("node"), campaignPda.toBuffer(),
     creator.publicKey.toBuffer(), metadataHash],
    PROGRAM_ID
  );

  return await program.methods
    .createNode(1, Array.from(metadataHash), bytesMetadata)
    .accounts({
      node: nodePda,
      campaign: campaignPda,
      creator: creator.publicKey,
      parentNode: null,
      systemProgram: SystemProgram.programId,
    })
    .signers([creator])
    .rpc();
}

// --- 5.3 Crear hoja ------------------------------------------------------
async function createLeaf(program, creator, campaignPda, l1, l2, l3, refCode, metaJson) {
  const refBuf = Buffer.from(refCode.padEnd(8, " ").slice(0, 8));
  const [leafPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("leaf"), campaignPda.toBuffer(), refBuf],
    PROGRAM_ID
  );
  const bytesMetadata = Buffer.from(JSON.stringify(metaJson)).length;

  return await program.methods
    .createLeaf(Array.from(refBuf), bytesMetadata)
    .accounts({
      leaf: leafPda,
      campaign: campaignPda,
      creator: creator.publicKey,
      nodeL1: l1, nodeL2: l2, nodeL3: l3,
      systemProgram: SystemProgram.programId,
    })
    .signers([creator])
    .rpc();
}

// --- 5.4 Claim payout (nodo o leaf) --------------------------------------
async function claimNodePayout(program, creator, nodePda, campaignPda, escrowAta, creatorUsdcAta) {
  return await program.methods.claimPayout()
    .accounts({
      node: nodePda,
      campaign: campaignPda,
      escrowUsdc: escrowAta,
      creatorUsdc: creatorUsdcAta,
      creator: creator.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([creator])
    .rpc();
}

async function claimLeafPayout(program, creator, leafPda, campaignPda, escrowAta, creatorUsdcAta) {
  return await program.methods.claimLeafPayout()
    .accounts({
      leaf: leafPda,
      campaign: campaignPda,
      escrowUsdc: escrowAta,
      creatorUsdc: creatorUsdcAta,
      creator: creator.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([creator])
    .rpc();
}

// --- 5.5 Marca retira USDC no usado --------------------------------------
async function withdrawUnusedUsdc(program, brand, campaignPda, escrowAta, brandUsdcAta) {
  return await program.methods.withdrawUnusedUsdc()
    .accounts({
      campaign: campaignPda,
      escrowUsdc: escrowAta,
      authorityUsdc: brandUsdcAta,
      authority: brand.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([brand])
    .rpc();
}
```

---

## 6. Errores custom

| Código | Nombre | Mensaje |
|---|---|---|
| 6000 | CampaignClosed | Campaña ya ha cerrado |
| 6001 | CampaignNotClosed | Campaña aún no ha cerrado |
| 6002 | UnauthorizedOracle | Firma de oracle inválida o no autorizada |
| 6003 | InvalidLevel | El nivel del nodo debe ser 1, 2 o 3 |
| 6004 | InvalidParentNode | Nodo padre inválido para el nivel |
| 6005 | InvalidGenealogicalPath | El path genealógico de la hoja es incorrecto |
| 6006 | InsufficientStake | Stake insuficiente provisto |
| 6007 | InsufficientFunds | No hay suficientes fondos para retirar |
| 6008 | MathError | Matemática falló en cálculo de payout |
| 6009 | ConversionAlreadyRegistered | La conversión ya fue registrada |
| 6010 | DataTooLarge | Excede máxima longitud de bytes |
| 6011 | InvalidWeights | Los pesos α + β + γ deben sumar 100 |
| 6012 | InvalidDeadline | La deadline debe ser una fecha futura |
| 6013 | NodeIsWinner | Solo nodos sin conversiones pueden ser forfeit |
| 6014 | NoStakeToForfeit | No hay stake para forfeit |
| 6015 | RedistributionAlreadyClaimed | El leaf ya reclamó su porción del pool |
| 6016 | PendingConversions | Aún hay conversiones sin procesar |
| 6017 | UnusedAlreadyWithdrawn | La marca ya retiró el USDC no usado |
| 6018 | NoUnusedUsdc | No hay USDC no usado para retirar |

---

## 7. Webhook del oracle (para B)

```http
POST http://oracle.host:3001/webhook/conversion
Content-Type: application/json

{
  "campaign_pubkey":  "<base58>",
  "leaf_pubkey":      "<base58>",
  "node_l1_pubkey":   "<base58>",
  "node_l2_pubkey":   "<base58>",
  "node_l3_pubkey":   "<base58>",
  "conversion_id":    "string-≤16-chars-único",
  "value_usdc":       100000000,
  "wallet_address":   "<base58 del comprador>"
}
```

Respuestas posibles:
- `200 { success: true, tx: "<sig>", pda: "<conversion-pda>" }`
- `400` payload inválido (pubkey malformada, falta campo)
- `409` backend de B rechaza la conversión (cuando `BACKEND_VERIFY_URL` está configurado)
- `429` anti-fraude (rate limit por wallet+campaign, IP, ráfaga)
- `500` error firmando o RPC
- `502` falló el llamado a `BACKEND_VERIFY_URL`
- `503` programa no inicializado (IDL no cargado)
