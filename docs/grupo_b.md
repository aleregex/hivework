# Grupo B — Backend de metadata, indexer del árbol, MCP y agente AI del demo

> Tu trabajo es el puente entre el smart contract on-chain (Grupo A) y el frontend visual (Grupo C). Manejas todo lo que no debe ir en blockchain: metadata enriquecida, índice del árbol completo, tracking de clicks, y la integración con agentes AI. Eres también dueño del agente que correrá durante el demo creando nodos en vivo.

---

## Lo que hay que entregar

### 1. Backend con APIs HTTP

Un servidor (FastAPI o Express, lo que prefieras) que:

- Almacena metadata enriquecida que no cabe en el contrato (descripciones largas, imágenes, ejemplos, tags)
- Sirve el árbol completo de cada campaña al frontend, combinando datos on-chain con metadata off-chain
- Maneja la creación inicial de campañas, nodos y hojas en dos pasos: primero metadata off-chain (draft), luego confirmación cuando la transacción on-chain se confirma
- Trackea clicks en links de hojas
- Recibe webhooks de "conversiones potenciales" y las pasa al oracle

### 2. Indexer del blockchain

Un servicio que:

- Suscribe a los eventos del programa de Anchor (CampaignCreated, NodeCreated, LeafCreated, ConversionRegistered, CampaignClosed)
- Mantiene un cache local del árbol completo y sus stats
- Invalida cache cuando llegan eventos nuevos
- Permite que el frontend consulte el árbol en milisegundos sin pegar al RPC

### 3. Servicio de short-link

Un endpoint público tipo `tudominio.link/{ref_code}` que:

- Recibe el click
- Registra el evento (timestamp, IP hash, user agent hash) en la base
- Setea cookie de tracking de primera parte
- Redirecciona al destino final (en el demo, una página de confirmación de "compra")

### 4. MCP server

Un servidor MCP que expone las acciones del sistema como herramientas para que agentes AI puedan participar:

- `list_active_campaigns()` — devuelve campañas activas con metadata
- `get_tree(campaign_id)` — devuelve árbol completo
- `create_node(campaign_id, parent_id, level, metadata, stake)` — el agente firma con su wallet y crea
- `fork_node(node_id, modifications)` — crea un nodo nuevo basado en otro existente
- `create_leaf(campaign_id, path, content_url, stake)` — registra una publicación con su path
- `query_my_portfolio(wallet_address)` — devuelve nodos creados, stakes activos, payouts esperados

### 5. Agente AI de demo

Al menos un agente real conectado vía MCP que durante el demo:

- Detecta automáticamente la nueva campaña creada
- Analiza el contexto (producto, audiencia, presupuesto)
- Genera 3-5 nodos de decisiones de marketing en distintos niveles
- Firma transacciones con su wallet propia y stakea SOL
- Los nodos aparecen en el árbol del frontend en tiempo real

Este agente es el diferenciador clave del proyecto. Sin él, el demo se ve igual a otro affiliate platform.

---

## Modelo de datos off-chain mínimo

### Tabla `campaigns_metadata`

- `campaign_id` (referencia on-chain)
- `brand_name`, `brand_logo_url`
- `product_name`, `product_image_url`, `product_description`
- `redirect_url` (a dónde manda el short-link)
- `created_at`

### Tabla `nodes_metadata`

- `node_id` (referencia on-chain, hash del PDA)
- `campaign_id`
- `level` (1, 2 o 3)
- `parent_node_id`
- `creator_wallet`
- `title` (corto, ej: "Hook en aymara")
- `description` (extendida)
- `examples` (JSON con ejemplos concretos)
- `tags` (array)
- `media_urls` (imágenes/audios de referencia)
- `created_at`

### Tabla `leaves_metadata`

- `leaf_id` (referencia on-chain)
- `campaign_id`
- `path` (array de 3 node_ids)
- `creator_wallet`
- `ref_code` (código corto único)
- `content_url` (link al post en TikTok/IG/X)
- `platform`
- `created_at`

### Tabla `clicks`

- `click_id`
- `leaf_id`
- `timestamp`
- `ip_hash`
- `user_agent_hash`
- `referrer`

### Tabla `pending_conversions`

- `conversion_id`
- `leaf_id`
- `value` (USDC amount)
- `source_data` (JSON con la prueba de la conversión)
- `status` (pending / verified / pushed_to_chain / rejected)
- `created_at`

---

## Endpoints HTTP esperados

### Para el frontend (Grupo C)

- `GET /campaigns/active` — listar campañas activas, paginado, con filtros
- `GET /campaigns/{id}` — datos de una campaña + árbol completo
- `POST /campaigns/draft` — crear borrador antes de confirmar on-chain
- `POST /campaigns/finalize` — confirmar después de tx on-chain
- `POST /nodes/draft` — borrador de nodo
- `POST /nodes/finalize` — confirmar después de tx
- `POST /leaves/draft` — borrador de hoja, devuelve ref_code reservado
- `POST /leaves/finalize` — confirmar después de tx
- `GET /wallets/{address}/portfolio` — todo lo que ese wallet ha creado

### Endpoint público para conversiones del demo

- `POST /demo/convert` — el frontend llama esto cuando un usuario "compra" durante el demo. Recibe `ref_code` y simula que hubo conversión real, lo cual dispara al oracle.

### Endpoint de short-link

- `GET /l/{ref_code}` — registra click y redirecciona

### Endpoints MCP (separados de HTTP normal)

- Los expones según el protocolo MCP estándar
- Las llamadas requieren que el agente firme con su wallet (no pueden ser anónimas)

---

## Lo que necesitas de otros grupos

### Del Grupo A (Smart contract)

- **IDL del programa** lo antes posible, aunque sea con instrucciones stub. Esto te desbloquea para empezar a integrar.
- **Pubkey del programa en devnet** y RPC endpoint que estén usando
- **Lista exacta de eventos que emite el programa** con sus campos para construir el indexer
- **Especificación de cómo firmar conversiones** desde tu oracle (formato de bytes, algoritmo)
- **Ejemplo de transacción exitosa** para cada instrucción (te ayuda a debuggear el indexer)

### Del Grupo C (Frontend)

- **Lista de campos de metadata que necesita el frontend** para que cada API devuelva exactamente lo que se va a mostrar (no más, no menos)
- **Decisión sobre dónde redirige el short-link en el demo** (qué URL exactamente)
- **Wallet de prueba del agente AI** si quieren que tenga aspecto distintivo en la UI

### Cosas que necesitas pedir explícitamente al inicio

- ¿Qué LLM va a usar el agente AI? Claude API, GPT, Gemini, local? Esto afecta el setup.
- ¿Las wallets de los agentes son custodial (manejadas por el backend) o cada agente tiene la suya? Decisión clave para el flujo.
- ¿Cómo se autentica el frontend al backend? JWT con wallet signature es el estándar Web3.

---

## Lo que tienes que entregar a los otros grupos

### Al Grupo A

- **Lista de pubkeys de oráculos** que A debe configurar en el programa como autorizadas
- **Webhooks o endpoints** que A puede usar para verificar conversiones contra metadata off-chain (anti-fraude reforzado)

### Al Grupo C

- **Documentación de todas las APIs** apenas estén disponibles, aunque sea con respuestas mockeadas. El formato OpenAPI/Swagger es ideal.
- **Ejemplos concretos de respuestas JSON** para cada endpoint, para que C pueda construir la UI con datos realistas
- **Endpoint de WebSocket o Server-Sent Events** si vas a hacer updates en tiempo real (recomendado para que el árbol se actualice cuando el agente AI crea nodos durante el demo)
- **URL del MCP server** y documentación mínima de cómo se conecta un agente externo (por si los jueces preguntan)

---

## Stack y herramientas

- **Backend:** FastAPI (Python) o Express (Node.js). Recomendación: lo que el equipo conozca mejor. No es momento de aprender un stack nuevo.
- **Base de datos:** PostgreSQL es lo más estándar. SQLite también sirve para 12 horas si no quieren montar Postgres.
- **Cache:** Redis si el árbol se vuelve grande. Memoria del proceso es suficiente para el demo.
- **Indexer:** WebSocket subscription al RPC de Solana usando `@solana/web3.js` o equivalente
- **MCP server:** SDK oficial de MCP (Anthropic publicó uno en TypeScript y Python)
- **Agente AI:** Claude API (más fácil para integrar con MCP) o GPT-4. El agente puede ser un script simple en Python o Node que corre en bucle.

---

## Riesgos a vigilar

**1. El indexer se desfasa del estado real on-chain.** Si pierdes eventos por desconexión del WebSocket, el árbol que muestra el frontend va a estar incompleto. Solución: backfill periódico que compara el cache local con el estado on-chain real.

**2. Llamadas RPC excesivas.** Solana RPCs públicos rate-limitan. Si tu indexer y tu API pegan al RPC en cada request, te bloquean rápido. Solución: usar Helius o Alchemy con plan gratuito decente (Helius da 100k requests/día gratis).

**3. El agente AI hace cosas raras.** Si el agente está mal calibrado, puede crear nodos basura, gastar SOL en stakes que no convertirán, o quedarse loop infinito. Solución: rate limit estricto (máximo N nodos por hora), watchdog que mata el agente si stakea más de X SOL en una sesión.

**4. Race condition entre draft y finalize.** Alguien crea un draft, otra persona crea uno con el mismo ref_code antes de finalizar. Solución: ref_code se reserva al crear draft con expiración de 5 minutos.

**5. Privacidad de IPs en clicks.** Almacenar IP cruda es problemático regulatoriamente. Solución: hash con sal antes de guardar, o solo geolocalizar (país/ciudad) y descartar.

---

## Sobre el agente AI del demo

Este es el componente más visible del trabajo de tu grupo. Sin él, el demo no se siente "vivo" ni diferenciado. Recomendaciones específicas:

**1. El agente debe tener personalidad visible.** Un nombre, una wallet identificable en la UI con badge de "agente", estilo de creación de nodos consistente. Esto hace que los jueces noten "ese fue el agente, esto lo hizo el humano".

**2. Idealmente conectar con Claude Desktop.** Si logras que un juez pueda hablarle a Claude Desktop ("crea una campaña para Café Yungas") y Claude ejecute todo vía MCP en vivo, eso es 10/10 wow factor. Si no llega el tiempo, un agente que corre en bucle automático también funciona.

**3. El agente debe tomar decisiones reales, no scripts.** Evita "el agente crea estos 5 nodos hardcodeados". Mejor: el agente recibe el contexto de la campaña y decide qué crear basándose en su prompt. Aunque las decisiones sean simples, deben venir del LLM.

**4. Logging visible del razonamiento.** Si los jueces preguntan "¿por qué creó ese nodo?", deberías poder mostrar el log del LLM razonando. Esto convierte el agente de "magia" a "transparente y auditable".

---

## Definición de "done" para tu grupo

- [ ] Backend deployado y accesible públicamente (Railway, Fly.io, Vercel, lo que sea)
- [ ] Base de datos con esquema funcional y datos de prueba
- [ ] Todas las APIs HTTP responden con formato correcto
- [ ] Indexer escuchando eventos del programa y actualizando cache
- [ ] Short-link service funcionando con tracking de clicks
- [ ] Endpoint de "compra" del demo disparando al oracle correctamente
- [ ] MCP server corriendo y aceptando conexiones
- [ ] Al menos un agente AI conectado y creando nodos automáticamente
- [ ] Documentación de APIs (Swagger o equivalente) compartida con el frontend
- [ ] Logs y monitoring básico para que los demás puedan ver qué pasa si algo falla
