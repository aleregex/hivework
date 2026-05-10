# Hivework — Smart Contract & Oracle (Grupo A)

Programa Anchor para el protocolo Hivework: marketing descentralizado con campañas, árboles de contenido, staking anti-spam y distribución proporcional de USDC.

## Estructura del proyecto

```
Contract/
├── programs/hivework/src/
│   ├── lib.rs          # 7 instrucciones del programa
│   ├── state.rs        # Structs: Campaign, Node, Leaf, Conversion
│   ├── constants.rs    # Stakes, fees, pesos por defecto
│   ├── errors.rs       # 11 errores custom con códigos 6000-6010
│   └── events.rs       # 5 eventos para indexer
├── oracle/
│   ├── index.js        # Servicio Oracle (Node.js + Express)
│   ├── package.json
│   └── .env.example    # Template de configuración
├── target/
│   ├── idl/hivework.json   # IDL para Grupos B y C
│   └── deploy/hivework.so  # Binario deployable
├── Anchor.toml
└── Cargo.toml
```

## Requisitos

- Rust + Cargo
- Solana CLI (`sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`)
- Anchor CLI (`avm install latest && avm use latest`)
- Node.js 18+ (para Oracle y tests)

## Compilar

```bash
cd Contract
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build
```

## Deploy a devnet

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

El Program ID se imprime en consola. Actualízalo si cambia con `anchor keys sync`.

## Correr el Oracle

```bash
cd oracle
npm install
cp .env.example .env
# Editar .env con la llave privada del oracle y el PROGRAM_ID
npm start
```

## Instrucciones del programa

| Instrucción | Descripción |
|---|---|
| `create_campaign` | Marca crea campaña con escrow USDC y pesos α,β,γ |
| `create_node` | Crear nodo (L1/L2/L3) con stake obligatorio en SOL |
| `create_leaf` | Creator registra publicación con path genealógico |
| `register_conversion` | Solo oracle: registra conversión verificada |
| `close_and_distribute` | Cierra campaña y distribuye USDC por batch |
| `claim_payout` | Wallet retira USDC acumulado (nodos) |
| `claim_leaf_payout` | Wallet retira USDC acumulado (hojas) |

## Stakes anti-spam

| Nivel | Stake |
|---|---|
| Nodo L1 (hook) | 1.0 SOL |
| Nodo L2 (audio) | 0.5 SOL |
| Nodo L3 (visual) | 0.25 SOL |
| Hoja (publicación) | 0.1 SOL |

## Eventos emitidos

- `CampaignCreated` — campaign, authority, total_usdc, deadline
- `NodeCreated` — node, campaign, creator, level
- `LeafCreated` — leaf, campaign, creator, ref_code
- `ConversionRegistered` — conversion, campaign, leaf, value
- `CampaignClosed` — campaign, conversions_processed

## Errores custom (para Grupo C)

| Código | Nombre | Mensaje |
|---|---|---|
| 6000 | CampaignClosed | Campaña ya ha cerrado |
| 6001 | CampaignNotClosed | Campaña aún no ha cerrado |
| 6002 | UnauthorizedOracle | Firma de oracle inválida |
| 6003 | InvalidLevel | El nivel debe ser 1, 2 o 3 |
| 6004 | InvalidParentNode | Nodo padre inválido |
| 6005 | InvalidGenealogicalPath | Path genealógico incorrecto |
| 6006 | InsufficientStake | Stake insuficiente |
| 6007 | InsufficientFunds | No hay fondos para retirar |
| 6008 | MathError | Error en cálculo de payout |
| 6009 | ConversionAlreadyRegistered | Conversión ya procesada |
| 6010 | DataTooLarge | Excede máxima longitud |
| 6011 | InvalidWeights | α + β + γ ≠ 100 |
| 6012 | InvalidDeadline | Deadline en el pasado |

## Cambios v0.2 (USDC real + auth oracle)

### Firma de `create_campaign`

Ahora pide **6 args** (antes 5) y cuentas SPL Token:

```ts
program.methods
  .createCampaign(deadline, alpha, beta, gamma, campaignId, initialUsdc)
  .accounts({
    campaign: campaignPda,
    usdcMint,                  // ← NUEVO
    escrowUsdc,                // ATA derivada de campaignPda + usdcMint
    authorityUsdc,             // ← NUEVO: ATA de la marca con USDC
    authority,
    oracleAuthority,           // ← NUEVO: pubkey del oracle autorizado
    tokenProgram,              // ← NUEVO
    associatedTokenProgram,    // ← NUEVO
    systemProgram,
    rent,                      // ← NUEVO
  })
```

### Firma de `claim_payout` y `claim_leaf_payout`

```ts
program.methods.claimPayout().accounts({
  node: nodePda,
  campaign: campaignPda,       // ← NUEVO (para firmar el CPI)
  escrowUsdc,                  // ← NUEVO
  creatorUsdc,                 // ← NUEVO ATA del creator
  creator,
  tokenProgram,                // ← NUEVO
})
```

### `register_conversion` ahora valida oracle

El signer `oracle` debe coincidir con `campaign.oracle_authority` o falla con `UnauthorizedOracle` (6002). El pubkey del oracle autorizado se fija al crear la campaña.

### Validaciones añadidas en `create_campaign`

- `alpha + beta + gamma == 100` → `InvalidWeights`
- `deadline > now` → `InvalidDeadline`
- `initial_usdc > 0`

### Campos nuevos en `Campaign`

- `id: u32`
- `usdc_mint: Pubkey`
- `oracle_authority: Pubkey`

## USDC en devnet

El demo necesita un mint de USDC para devnet. Dos opciones:

- **Mint propio de prueba** (recomendado para hackathon): `spl-token create-token --decimals 6` y luego `spl-token mint <MINT> 10000` a la wallet de la marca antes del demo.
- **USDC oficial de Circle en devnet**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Requiere conseguir tokens vía faucet de Circle.

## Correr tests

```bash
cd Contract
npm install      # primera vez
anchor test --provider.cluster devnet
```
