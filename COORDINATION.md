# Coordinación del equipo Hivework

> Documento vivo de coordinación. Cada grupo lo actualiza con la info que su trabajo necesita exponer al resto. Mantenerlo actualizado es la única forma de no chocarnos en 12 horas.

---

## Comunicación

- **Canal principal:** [LINK al Telegram/Discord — completar]
- **Repo:** https://github.com/aleregex/hivework
- **Branches:** trabajamos en `main`. Si hay riesgo, ramas tipo `groupA/feature-x` y merge frecuente.
- **Norma:** cada commit con mensaje claro. Cada hora, push del trabajo aunque esté incompleto.

---

## Wallets de prueba en devnet

Cada grupo declara sus wallets aquí. Quien necesite SOL/USDC pre-fundeado se lo pide al Grupo A.

### Wallets del Grupo A (smart contract + oracle)

| Rol | Pubkey | Notas |
|-----|--------|-------|
| Deploy authority | `4UQ9JiFa52n3YMUE6gHEBRSqpxJ9Y6shyTF7mZocLJpW` | Quien deployó el programa (3.17 SOL disponibles) |
| Oracle keypair | `FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU` | Pubkey autorizada en el contrato para firmar conversiones |

### Wallets del Grupo B (backend + agente AI)

| Rol | Pubkey | Notas |
|-----|--------|-------|
| Agente AI principal | `EMwSrLzbFfU5PvcrnP1jkf2QJdeRJvEXoghTVpnM3Va4` | Wallet del agente AI principal (`Apis`), generada por B/agent. `agent/agent-wallet.json` (gitignored). Necesita pre-fundeo: ≥5 SOL devnet para gas + staking. **Devnet only**. |
| Agente AI secundario (opcional) | `[completar]` | Por si quieren mostrar varios agentes |
| Oracle keypair | `FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU` | Generada y operada por B3 (`indexer/oracle.json`, gitignored). Necesita pre-fundeo: ≥5 SOL devnet para gas. Grupo A debe autorizarla en el contrato al deploy. |

### Wallets del Grupo C (frontend + demo)

| Rol | Pubkey | Notas |
|-----|--------|-------|
| Marca demo | `DPYGZFEBpbWy4ZrtffidiwX6e4o1BViPRa12nSaGJNpJ` | Wallet que crea la campaña en el demo |
| Creator humano 1 | `HDB8PCh2n9LeJaMxc6p2MjEZqLxLKYqNN8JpWrFLHga1` | Miembro del equipo que crea nodos durante demo |
| Creator humano 2 | `54ZWDopbSHSECW46MBqs6HSUDCWgqMkzH7BbQPsjifgY` | Miembro del equipo que publica hojas |
| Creator humano 3 | `Dn9Ybbbj8tN6R93pVyEgeSYwRumpzMv4b2KymJnZQUE8` | Miembro del equipo que "compra" durante demo |

> Generadas con `cd web && node scripts/gen-wallets.mjs`. Los archivos JSON con las secret keys viven en `web/.local-keys/` (gitignored). Si se pierden, regenerar y actualizar pubkeys aquí. **Devnet only**.

### Pre-fundeo necesario

Antes del demo, todas las wallets deben tener:

- Mínimo 5 SOL en devnet (para gas + staking)
- Las wallets de creators: 2-3 SOL para staking de nodos
- La wallet de la marca: equivalente a 100 USDC en devnet (mockUSDC del scaffold sirve)

Quien fondea: el Grupo A vía `solana airdrop` y el faucet de USDC mock del scaffold.

---

## Configuración compartida

### URLs y endpoints

| Servicio | URL devnet/staging | Owner |
|----------|-------------------|-------|
| RPC de Solana | `https://api.devnet.solana.com` | (público) |
| Backend API | `[completar cuando deploy]` | Grupo B |
| MCP server | `[completar cuando deploy]` | Grupo B |
| Frontend deploy | `https://hivework-two.vercel.app` | Grupo C |
| Short-link domain | `[completar — ej: hivework.link/abc]` | Grupo B |

### Variables de entorno críticas

Cada grupo debe documentar las suyas en su sub-proyecto. Las que TODOS deben conocer:

- `NEXT_PUBLIC_PROGRAM_ID` — `8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8` (deployado en devnet)
- `NEXT_PUBLIC_API_URL` — URL del backend (lo da Grupo B al deploy)
- `NEXT_PUBLIC_RPC_ENDPOINT` — RPC de Solana
- `ORACLE_PRIVATE_KEY` — solo Grupo A, en su servicio de oracle

### LLM para el agente AI

Decisión: `[completar — Claude API / GPT-4 / Gemini / Llama local]`

Esto afecta:
- API key necesaria (en .env del backend)
- Costo del demo (Claude/GPT cuestan por token)
- Velocidad de respuesta (Claude API es más rápido para MCP)

### Decisión sobre custodial vs no-custodial para agentes

`[completar — recomendación: no-custodial, cada agente con wallet propia]`

---

## Decisiones técnicas alineadas

Estas son decisiones que afectan a múltiples grupos. Cuando se confirmen, marcarlas con ✅:

- [x] Estructura del path genealógico: ✅ **`array de 3 pubkeys` (L1, L2, L3)** — guardado en `Leaf.genealogical_path: [Pubkey; 3]`. Validación en `create_leaf` y `register_conversion`.
- [x] Formato del ref_code: ✅ **`[u8; 8]` ASCII** — derivable como seed de la PDA del Leaf (`["leaf", campaign, ref_code]`).
- [x] Hash de metadata: ✅ **SHA-256 del JSON canónico** — el creador firma `bytes_metadata` (tamaño en bytes) y `metadata_hash` (32 bytes). El indexer guarda el JSON real off-chain.
- [x] Platform fee: ✅ **5%** — hardcoded en `PLATFORM_FEE_PERCENTAGE`. Configurable por contrato en v2.
- [x] Pesos default de la fórmula: ✅ **α=40, β=40, γ=20** (pct enteros, suman 100). La marca puede pasar otros valores en `create_campaign`.
- [x] Levels obligatorios: ✅ **L1 + L2 + L3 + leaf** validados por contrato. `create_node` rechaza level ≠ 1/2/3.
- [ ] Auth frontend → backend: `wallet signature como JWT`
- [ ] Realtime updates: `WebSocket` o `Server-Sent Events`
- [ ] Color final del branding: `[a definir]`

---

## Schedule del equipo

### Bloques de trabajo (10 horas)

- **Bloque 1 (horas 0-2):** Setup paralelo. Cada grupo tiene scaffold básico funcionando. Grupo C deploya shell en Vercel.
- **Bloque 2 (horas 2-4):** Core development. Grupo A entrega IDL provisional al final. Grupo B entrega APIs mockeadas. Grupo C tiene landing + skeleton de vistas con mocks.
- **Bloque 3 (horas 4-6):** Integración E2E. Demo completo conectado punta a punta aunque feo.
- **Bloque 4 (horas 6-8):** Polish, animación de cascada USDC, contenido pre-poblado en el árbol.
- **Bloque 5 (horas 8-9):** Pitch deck + script + grabación de video backup.
- **Bloque 6 (horas 9-10):** Ensayos finales del demo + submissions a Dev3pack y Colosseum.

### Sync points obligatorios

- **Hora 2:** check rápido de los 3 grupos (10 min) — "¿alguien está bloqueado?"
- **Hora 4:** Grupo A entrega IDL provisional + Grupo B entrega APIs mockeadas. Demo dry-run #1 con datos hardcoded.
- **Hora 6:** integración real (no más mocks) — todo conectado punta a punta. Demo dry-run #2.
- **Hora 8:** animación de cascada lista. Demo dry-run #3 con flujo completo.
- **Hora 9:** grabación de video backup + ensayo final del pitch.

### Ensayos del demo

Cada ensayo debe incluir a:
- Persona del Grupo C presentando
- Persona del Grupo A en máquina con Solscan abierto
- Persona del Grupo B confirmando que el agente AI esté corriendo

Al menos los 3 ensayos. Si llega a 5, mejor.

---

## Plan de contingencia: qué hacer si algo falla

### Si el smart contract no termina a tiempo

- Hardcodear los payouts finales en el frontend (calculados off-chain)
- En el pitch decir: "el contrato ejecuta esto en mainnet, hoy mostramos el resultado"
- Aún registrar las creaciones de nodos/hojas/conversiones reales on-chain
- Lo único que no estaría on-chain sería la distribución final

### Si el backend falla en el demo

- Todos los datos de campaña, árbol y conversiones están on-chain (pueden leerse directo del RPC)
- Pre-cargar el árbol del demo en localStorage del frontend como backup
- Tener Solscan abierto como fuente de verdad alternativa

### Si el agente AI no funciona en vivo

- Tener video pre-grabado del agente operando
- Mostrar logs y razonamiento del LLM como prueba
- Cambiar la narrativa a "este es el flujo, hoy el agente corrió en background creando estos nodos antes del demo"

### Si la conexión a internet falla

- Tener video backup completo de 3 minutos del flujo end-to-end
- Tener screenshots de cada pantalla crítica
- Tener Solscan capturado en PDF como evidencia on-chain

---

## Submission targets

### Dev3pack (obligatorio)

- [ ] Track principal: Solana ($10K)
- [ ] Track ElevenLabs si se integra audio del agente
- [ ] Bonus x402 si se integran pagos a APIs vía x402
- [ ] Track Solana Mobile si la PWA está pulida

URL submission: `[completar]`

### Colosseum (side track, $250K + $2M seed)

- [ ] Submission separada con pitch deck extendido
- [ ] Modelo financiero básico
- [ ] Plan de go-to-market post-hackathon

URL submission: `[completar]`

---

## Roles del demo final

Asignación de quién hace qué durante los 3 minutos:

| Rol | Persona |
|-----|---------|
| Presenta el pitch | `[completar — Grupo C]` |
| Maneja la laptop principal con frontend | `[completar — Grupo C]` |
| Maneja Solscan en pantalla auxiliar | `[completar — Grupo A]` |
| Confirma agente AI corriendo en backend | `[completar — Grupo B]` |
| "Compra" en vivo durante demo | `[completar — cualquiera]` |
| "Crea nodo" en vivo durante demo | `[completar — cualquiera]` |
| Backup person en caso de bloqueo | `[completar]` |

---

## Notas finales

- Dormir antes del demo: al menos 1 hora la persona que presenta
- Comer: planificado, no se olvida
- Cargadores: cada laptop tiene el suyo, más uno extra
- Internet: 4G de respaldo activado en al menos un celular del equipo
- Red de stage: probar conexión al WiFi del venue 1 hora antes
