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
| `forfeit_node_stake` | Forfeit stake de un nodo perdedor → pool de redistribución |
| `forfeit_leaf_stake` | Forfeit stake de una hoja perdedora → pool de redistribución |
| `claim_redistribution` | Hoja ganadora reclama su porción del pool forfeit |

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
| 6013 | NodeIsWinner | Solo nodos sin conversiones pueden ser forfeit |
| 6014 | NoStakeToForfeit | No hay stake para forfeit |
| 6015 | RedistributionAlreadyClaimed | El leaf ya reclamó su porción del pool |

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

## Fórmula implementada (literal del spec)

```
peso(nodo) = α × ln(forks_descendientes + 1)
           + β × min(bytes_metadata / 1000, 1.0)
           + γ × position_factor[nivel]
```

- `α = 0.4`, `β = 0.4`, `γ = 0.2` (configurable por la marca, deben sumar 100)
- `position_factor`: L1=1.0, L2=0.7, L3=0.5, leaf=0.3
- `ln(x)` aproximado on-chain como `ilog2(x) × ln(2)` con escalado entero (sin floats)
- `bytes_metadata` lo aporta el creador al llamar `create_node`/`create_leaf`. Debería corresponder al tamaño en bytes del JSON canónico de metadata. La marca puede inspeccionar el `metadata_hash` (SHA-256) y el indexer guarda el JSON real.

Distribución de cada conversión:

1. Resta 5% de platform_fee
2. Reserva 30% bonus para el leaf
3. Restante (65% de la conversión) se reparte entre L1, L2, L3 y leaf según pesos
4. El leaf recibe su porción + el 30% bonus

## Redistribución de stakes (anti-spam con incentivo positivo)

- Al cierre, cualquiera puede llamar `forfeit_node_stake` / `forfeit_leaf_stake` sobre cuentas con `conversions_count == 0` y `stake_locked > 0`. El stake se mueve a `Campaign.forfeited_pool`.
- Cada leaf ganadora puede llamar `claim_redistribution` UNA vez para retirar `pool × leaf.conversions_count / campaign.total_conversions` lamports.
- Decisión MVP: solo leaves participan en la redistribución (no los nodos), porque cada conversión incrementa exactamente un leaf, dando una proporción matemáticamente limpia. Los nodos ganadores ya recuperan su stake completo al hacer `claim_payout`.

## Anti-fraude del oracle

`oracle/index.js` aplica los 3 filtros del spec antes de firmar:
1. **Validación de wallet/pubkey**: todas las pubkeys del payload deben ser base58 válidas.
2. **IP no duplicada**: máx 5 conversiones por IP en 60s, con intervalo mínimo de 5s.
3. **Timing por wallet+campaign**: misma wallet/leaf no puede repetir < 30s.

## Configuración del oracle (con la keypair de B3)

B3 ya generó la keypair en `indexer/oracle.json` con pubkey `FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU`. Para correr el oracle service apuntando a ese archivo:

```bash
cd Contract/oracle
cp .env.example .env
# .env ya viene con ORACLE_KEYPAIR_PATH=../../indexer/oracle.json
npm install
npm start
```
