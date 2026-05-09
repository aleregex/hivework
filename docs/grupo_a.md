# Grupo A — Smart contract on-chain, oracle de conversiones y staking

> Tu trabajo es construir y mantener todo lo que vive en Solana: el programa Anchor con sus structs y instrucciones, más el servicio de oracle que verifica conversiones off-chain y las firma hacia el contrato. Eres la base sobre la que los otros dos grupos construyen.

---

## Lo que hay que entregar

### 1. Programa Anchor deployado en devnet

Un programa que maneja:

- **Campañas de marketing** con escrow de USDC, deadline, criterios de conversión, y pesos personalizables de la fórmula
- **Nodos del árbol** con padre, nivel, metadata_hash, stake bloqueado en SOL, contador de forks descendientes, contador de conversiones acumuladas
- **Hojas (publicaciones)** con path genealógico al árbol, código de referido único, stake bloqueado, y contador de conversiones
- **Conversiones** firmadas por oracle autorizado, atribuidas a una hoja específica
- **Cierre y distribución** que aplica la fórmula proporcional, libera stakes según performance, y devuelve USDC no usado a la marca

### 2. Servicio de oracle off-chain

Un servicio (puede ser un script de Node o Python con cron) que:

- Recibe webhooks o polea endpoints del backend cuando hay potenciales conversiones
- Valida que la conversión es real (anti-fraude básico: verificación de wallet, IP no duplicada, timing razonable)
- Firma criptográficamente la conversión con la keypair autorizada del oracle
- Llama la instrucción `register_conversion` del contrato

### 3. IDL completo y documentado

El archivo IDL del programa que B y C van a consumir para integrar.

---

## Anti-fraude vía staking obligatorio

Esta es la única defensa anti-fraude del MVP. Implementarla bien es crítico.

**Stakes obligatorios al crear elementos:**

| Acción | Stake en SOL |
|--------|--------------|
| Crear nodo nivel 1 (hook, decisión raíz) | 1.0 SOL |
| Crear nodo nivel 2 (música/audio) | 0.5 SOL |
| Crear nodo nivel 3 (visual/momento clave) | 0.25 SOL |
| Crear hoja (publicación con link) | 0.1 SOL |

**Liberación de stakes al cierre de la campaña:**

- Si el nodo (o sus descendientes en el árbol) generaron al menos 1 conversión: el stake se libera al creador
- Si el nodo no generó nada: el stake se queda en el pool y se redistribuye proporcionalmente entre los nodos exitosos

Esto elimina spam, alinea incentivos, y reemplaza la moderación humana con economía pura.

---

## Fórmula de payout proporcional

Cuando la campaña cierra, el contrato debe iterar todas las conversiones y distribuir USDC proporcionalmente a todos los nodos en el camino genealógico de cada conversión.

**Para cada conversión registrada:**

1. Reconstruir el path genealógico: `[nodo_nivel_1, nodo_nivel_2, nodo_nivel_3, hoja]`
2. Calcular el peso de cada nodo del path:

```
peso(nodo) = α × log(forks_descendientes + 1)
           + β × richness_score
           + γ × position_factor[nivel]
```

Donde:
- `α = 0.4` peso de popularidad (cuántos forks ha generado el nodo)
- `β = 0.4` peso de riqueza de información (bytes_metadata / 1000, capped 0-1)
- `γ = 0.2` peso del nivel jerárquico
- `position_factor`: nivel 1 = 1.0, nivel 2 = 0.7, nivel 3 = 0.5, hoja = 0.3

3. Sumar pesos del path
4. Para cada nodo, calcular su porción:

```
payout_individual = (peso_nodo / suma_pesos_path) × valor_conversion × (1 - platform_fee)
```

5. Aplicar bonus 30% adicional al creator de la hoja
6. Aplicar platform fee del 5%

**Importante:** los pesos α, β, γ deben ser configurables por la marca al crear la campaña, con defaults razonables. Esto permite que diferentes marcas prioricen diferentes aspectos.

---

## Instrucciones que el programa debe exponer

- `create_campaign` — la marca crea campaña, deposita USDC en escrow
- `create_node` — alguien crea un nodo (humano vía frontend o agente vía MCP), bloquea SOL como stake
- `create_leaf` — un creator registra una hoja con su path genealógico, bloquea SOL
- `register_conversion` — solo callable por oracle autorizado, registra una conversión y actualiza contadores ancestrales
- `close_and_distribute` — al deadline, calcula fórmula y distribuye USDC + libera stakes
- `claim_payout` — cualquier wallet con balance acumulado lo retira

---

## Lo que necesitas de otros grupos

### Del Grupo B (Backend)

- **Endpoint que el oracle llama** para verificar potenciales conversiones contra la metadata off-chain antes de firmar
- **Indexer escuchando eventos del programa** (CampaignCreated, NodeCreated, LeafCreated, ConversionRegistered, CampaignClosed) para que el frontend tenga datos al instante
- **Lista de pubkeys de oráculos autorizados** para incluir en la configuración del programa al deploy

### Del Grupo C (Frontend)

- **Confirmación de qué wallets de prueba van a usar** durante el demo, para que puedas pre-fundearlas con SOL para staking en devnet

### Cosas que necesitas pedir explícitamente al inicio

Antes de empezar a codear, conseguir alineación con B y C en:

- Estructura del path genealógico (¿array de pubkeys? ¿array de seeds?)
- Formato del código de referido (longitud, charset)
- Cómo se serializa la metadata_hash (¿SHA-256 sobre el JSON completo?)
- Decisión sobre el platform_fee (5% al inicio, configurable después)

---

## Lo que tienes que entregar a los otros grupos

### Al Grupo B

- **IDL del programa** apenas tengas las instrucciones core funcionando, aunque sea sin la lógica completa de payout. Esto desbloquea a B para empezar el indexer y las APIs.
- **Lista de eventos que emite el programa** con sus campos exactos (nombres, tipos, semántica)
- **Pubkey del programa deployado en devnet** para que B configure su conexión
- **Especificación clara de cómo firmar conversiones** desde el oracle (qué bytes se firman, qué algoritmo)

### Al Grupo C

- **IDL del programa** (mismo que para B)
- **Ejemplos de transacciones serializadas** para crear campaña, crear nodo, crear hoja, claim payout. Esto le ahorra a C horas de figuring out cómo construir transacciones.
- **Lista de errores custom del programa** con códigos y mensajes claros, para que C pueda mostrar feedback útil al usuario

---

## Stack y herramientas

- **Lenguaje:** Rust con Anchor framework
- **Network:** Solana devnet
- **Wallet:** Solana CLI keypair para deploys
- **Testing:** Anchor tests con Mocha (incluido en el scaffold)
- **Oracle service:** Node.js o Python, lo que prefieras (el oracle no necesita ser sofisticado)

Si vas con Node para el oracle: usa `@solana/web3.js` y `@coral-xyz/anchor` para llamar al programa. Si vas con Python: usa `solana-py` y `anchorpy`.

---

## Riesgos a vigilar

**1. Compute units exhausted al distribuir.** Si una campaña tiene cientos de conversiones, iterar todas en una sola transacción puede explotar los límites de CU. Solución: la instrucción `close_and_distribute` puede ser idempotente y procesar batches; cada llamada procesa N conversiones. La marca o cualquiera llama hasta que terminen.

**2. Reentrancia en claim_payout.** Asegurarte que el balance se actualiza ANTES de hacer la transferencia, no después.

**3. Validación de path en create_leaf.** Verificar que los 3 nodos del path están conectados genealógicamente (nivel 2 es hijo del nivel 1, nivel 3 es hijo del nivel 2). Sin esto, alguien podría crear hojas con paths inválidos.

**4. Oracle como punto único de falla.** En MVP es aceptable, pero documenta claramente que en producción se necesita multi-sig de oráculos. Esto es lo que un juez técnico va a preguntar.

**5. Stakes en SOL vs USDC.** Decisión: stakes en SOL (más simple, no necesitas un token escrow separado). USDC solo para el pool de la campaña.

---

## Definición de "done" para tu grupo

- [ ] Programa deployado en devnet con program ID estable
- [ ] Las 6 instrucciones core funcionan end-to-end (creator → campaña → nodo → hoja → conversión → cierre → claim)
- [ ] Tests automáticos del happy path pasan
- [ ] IDL exportado y compartido con B y C
- [ ] Oracle service corriendo y firmando conversiones reales contra el contrato
- [ ] Documentación mínima en el repo: cómo deployar, cómo correr tests, cómo correr el oracle
- [ ] Las wallets de demo tienen SOL pre-fundeado para hacer staking durante el demo
