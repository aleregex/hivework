# Flujo de trabajo de la plataforma

> Documento operativo que describe paso a paso cómo funciona el sistema desde la creación de una campaña hasta la distribución final de payouts. Complementa el documento de diseño del proyecto.

---

## Visión general

El flujo completo se divide en **5 fases secuenciales** que ocurren a lo largo del ciclo de vida de una campaña. Cada fase tiene actores específicos, acciones on-chain y off-chain, y outputs medibles.

| Fase | Duración típica | Actores principales | Estado del árbol |
|------|----------------|---------------------|------------------|
| 1. Creación | Minutos | Marca | Vacío con root |
| 2. Construcción | 1-3 días | Humanos + Agentes AI | En crecimiento |
| 3. Publicación | Continuo | Creators (humanos/agentes) | Hojas activas |
| 4. Conversión | Continuo | Consumidores finales | Conversiones acumulando |
| 5. Cierre | Minutos | Smart contract | Distribuido y archivado |

---

## Fase 1 — Creación de campaña

### Actor: Marca

### Objetivo

Bloquear presupuesto en escrow on-chain y publicar un árbol vacío al que cualquiera pueda contribuir.

### Pasos detallados

**Paso 1.1 — Conectar wallet**

La marca abre la plataforma y conecta su wallet de Solana (Phantom, Solflare, Backpack). El sistema valida que tiene USDC suficiente para el presupuesto que va a bloquear.

**Paso 1.2 — Definir parámetros de campaña**

La marca completa un formulario con:

- Nombre y descripción del producto
- URL del storefront donde ocurre la conversión
- Presupuesto total en USDC
- Deadline de la campaña (típicamente 7-30 días)
- Criterio de conversión (compra completada, registro, mint de NFT, suscripción, donación)
- Valor de cada conversión (cuánto USDC se distribuye por venta)
- Pesos personalizados de la fórmula (opcional, defaults razonables)
- Plantillas iniciales (opcional, sugiere 3-5 nodos genéricos para arrancar)

**Paso 1.3 — Firma y depósito**

La marca aprueba la transacción de creación. Phantom muestra:

- Crear PDA de la campaña
- Transferir USDC del wallet de la marca al PDA del escrow
- Inicializar metadata on-chain

La transacción se confirma en Solana en 1-2 segundos. El TX hash es visible en Solscan.

**Paso 1.4 — Publicación del árbol**

El sistema genera:

- URL pública del árbol (ej: `plataforma.com/c/{campaign_id}`)
- Link compartible para creators
- Endpoints de MCP para que agentes AI descubran la campaña

**Paso 1.5 — Anuncio**

La marca comparte el link en sus canales (X, Telegram, Discord, comunidades). Los agentes AI conectados al MCP empiezan a descubrir la nueva campaña automáticamente.

### Output de la fase

- Campaign PDA creada on-chain
- USDC bloqueado en escrow
- Árbol vacío publicado y descubrible
- Notificación a agentes registrados

---

## Fase 2 — Construcción colaborativa del árbol

### Actores: Humanos + Agentes AI + Marca misma

### Objetivo

Poblar el árbol con decisiones de marketing en los niveles 1, 2 y 3, generando una matriz rica de combinaciones posibles.

### Sub-flujo A: Creator humano

**Paso 2A.1 — Exploración**

El humano conecta wallet, navega árboles activos, filtra por categoría de producto, presupuesto disponible, y deadline cercano.

**Paso 2A.2 — Selección de oportunidad**

Identifica un nivel del árbol donde quiere contribuir (ejemplo: nivel 1 hooks). Ve qué nodos ya existen para evitar duplicados.

**Paso 2A.3 — Creación de nodo**

Llena el formulario del nodo:

- Nivel (1, 2 o 3)
- Padre (nodo del nivel anterior, o root si es nivel 1)
- Título de la decisión (ej: "Hook en aymara con énfasis emocional")
- Descripción extendida (máx 500 caracteres)
- Ejemplos concretos (texto, imagen de referencia, audio)
- Tags de categorización

**Paso 2A.4 — Stake**

Aprueba la transacción de staking según el nivel:
- Nivel 1: 1.0 SOL
- Nivel 2: 0.5 SOL
- Nivel 3: 0.25 SOL

El stake queda bloqueado en el contrato hasta el cierre de la campaña.

**Paso 2A.5 — Espera de uso**

El nodo aparece en el árbol público. El creador puede esperar a que otros lo forkeen o lo usen en hojas.

### Sub-flujo B: Agente AI vía MCP

**Paso 2B.1 — Descubrimiento automático**

El agente AI tiene un MCP server conectado a la plataforma. Cada cierto intervalo (configurable, típicamente cada hora), consulta el endpoint `list_active_campaigns` y recibe campañas relevantes a su especialidad.

**Paso 2B.2 — Análisis de la campaña**

El agente analiza:

- Producto y vertical
- Presupuesto y valor por conversión
- Estado actual del árbol (qué nodos existen)
- Patrones de éxito de campañas similares pasadas

**Paso 2B.3 — Decisión de contribución**

Basándose en su modelo, el agente decide:

- En qué nivel(es) crear nodos
- Qué tipo de nodos crear (basados en gaps detectados en el árbol)
- Cuántos nodos generar

**Paso 2B.4 — Generación de metadata**

El agente genera el contenido del nodo usando su LLM interno o herramientas conectadas. Por ejemplo, para un nodo de hook puede generar 5 variantes de texto, escoger la mejor según métricas internas, y subirla.

**Paso 2B.5 — Ejecución on-chain**

Vía MCP, el agente llama `create_node` con los parámetros y firma la transacción con su propia wallet, depositando el stake correspondiente.

**Paso 2B.6 — Tracking de su portfolio**

El agente mantiene un registro on-chain de los nodos que ha creado, sus stakes activos, y sus payouts esperados. Ajusta su estrategia para futuras campañas según su track record.

### Sub-flujo C: Forks de nodos exitosos

Cuando un nodo empieza a generar conversiones (vía sus hojas descendientes), se vuelve atractivo para forkear. El proceso de fork es similar a crear un nodo nuevo, con dos diferencias:

- El metadata referencia el `parent_fork_id` del nodo original
- El nuevo nodo debe tener metadata diferenciada (no puede ser copia exacta)

Forkear un nodo exitoso permite al nuevo creador apostar a que su variante convertirá mejor que el original. Si así es, ambos cobran (el original por ser el padre intelectual, el fork por ser la mejora).

### Output de la fase

- Árbol con docenas o cientos de nodos en niveles 1-3
- Stakes acumulados en el contrato
- Forks visibles, indicando qué decisiones ganan tracción
- Datos de actividad (quién creó qué, cuándo, popularidad)

---

## Fase 3 — Hojas y publicación en redes

### Actor: Creator de contenido (humano o agente)

### Objetivo

Convertir un camino del árbol en una pieza de contenido publicada en redes sociales con un link único de referido.

### Pasos detallados

**Paso 3.1 — Selección del camino**

El creator navega el árbol y selecciona un camino específico:

- Un nodo de nivel 1 (hook)
- Un nodo de nivel 2 (música) compatible con ese hook
- Un nodo de nivel 3 (visual) compatible con esa música

El sistema valida que el camino es válido (los nodos están conectados genealógicamente).

**Paso 3.2 — Generación del contenido**

El creator produce el contenido siguiendo las decisiones del camino:

- **Si es humano:** filma/edita el video manualmente respetando el hook, la música y el visual decididos
- **Si es agente AI:** usa APIs (Sora, Runway, ElevenLabs) para generar el contenido automáticamente
- **Híbrido:** humano hace el video real pero usa AI para algunos componentes (voiceover, edición)

**Paso 3.3 — Creación de hoja on-chain**

El creator llama `create_leaf` con:

- Path del árbol (los IDs de los 3 nodos del camino)
- Wallet del creator (donde recibirá el payout)
- URL del contenido publicado (opcional al inicio, completable después)
- Stake de 0.1 SOL

El contrato genera un `leaf_id` único y le asigna un `ref_code` corto (ej: `xK7m9p`).

**Paso 3.4 — Recepción del link**

El sistema le da al creator un link único:

```
plataforma.link/{ref_code}
```

Este link es el que va en el bio, descripción del video, o como link de "comprar ahora".

**Paso 3.5 — Publicación en redes**

El creator publica el contenido en su canal:

- TikTok: video con link en bio
- Instagram: reel con link en bio o sticker
- X: post con link clickeable
- YouTube Shorts: con link en descripción

**Paso 3.6 — Tracking**

Desde el momento de publicación, el sistema empieza a trackear:

- Clicks en el link único
- Conversiones derivadas
- Performance comparativa con otras hojas del mismo árbol

### Output de la fase

- Hoja registrada on-chain con su path al árbol
- Link único activo y trackeable
- Contenido publicado en redes sociales
- Stake bloqueado pendiente de liberación

---

## Fase 4 — Conversiones y atribución

### Actor: Consumidor final + Oracle

### Objetivo

Capturar conversiones reales generadas por las hojas y atribuirlas correctamente al árbol genealógico.

### Pasos detallados

**Paso 4.1 — Descubrimiento del contenido**

El consumidor final ve el video/post en su feed de redes sociales. Sin saber nada del sistema subyacente, solo ve un creator presentando un producto.

**Paso 4.2 — Click en el link**

Si el contenido lo convence, clickea el link. El servicio de short-link:

1. Registra el click con `leaf_id`, `timestamp`, `IP_hash`, `user_agent`
2. Setea una cookie de tracking de primera parte (válida X días)
3. Redirecciona al storefront de la marca con un parámetro `?ref=xK7m9p`

**Paso 4.3 — Visita al storefront**

El consumidor llega al sitio de la marca. El sitio lee el parámetro `ref` y/o la cookie y guarda esa atribución asociada a la sesión.

**Paso 4.4 — Conversión**

El consumidor completa la acción definida como conversión por la marca:

- Compra: completa el checkout y paga
- Registro: crea cuenta con email verificado
- Mint: ejecuta una transacción on-chain de mint de NFT
- Suscripción: paga primer mes
- Donación: completa transferencia

**Paso 4.5 — Verificación por oracle**

El oracle off-chain verifica la conversión con múltiples checks:

- ¿El pago/acción ocurrió realmente? (verifica con la API del storefront, blockchain explorer si es on-chain, o webhook firmado por la marca)
- ¿La wallet del comprador tiene historial mínimo? (anti-fraude básico)
- ¿La IP/dispositivo no ha convertido ya en esta campaña?
- ¿El timestamp es razonable (no sospechosamente cercano al click)?

**Paso 4.6 — Push on-chain**

Si la conversión pasa todos los checks, el oracle firma criptográficamente y llama `register_conversion` con:

- `leaf_id`
- `conversion_value` en USDC
- `timestamp`
- `oracle_signature`

**Paso 4.7 — Registro on-chain**

El smart contract:

1. Verifica la firma del oracle (debe ser una pubkey autorizada)
2. Crea PDA `Conversion`
3. Asocia la conversión al `leaf_id` correspondiente
4. Recorre el path genealógico del leaf y actualiza contadores en cada nodo ancestral
5. Emite evento `ConversionRegistered` para que indexers actualicen el frontend

**Paso 4.8 — Visibilidad en tiempo real**

En el frontend, los usuarios ven:

- El contador de la hoja sube
- Los nodos ancestrales se iluminan
- El balance estimado del payout para cada nodo del path se actualiza
- Notificaciones a los wallets relevantes

### Output de la fase

- Conversiones registradas on-chain
- Datos de performance acumulándose por nodo
- Marca obteniendo ventas reales
- Visibilidad transparente para todos los participantes

---

## Fase 5 — Cierre y distribución de payouts

### Actor: Smart contract (con trigger de marca o por deadline)

### Objetivo

Calcular y ejecutar la distribución proporcional de USDC entre todos los nodos que contribuyeron a las conversiones, y liberar stakes correspondientes.

### Pasos detallados

**Paso 5.1 — Trigger de cierre**

El cierre puede ocurrir por:

- **Deadline alcanzado:** automático, cualquiera puede llamar `close_campaign` y pagar el gas
- **Marca decide cerrar antes:** la marca firma `force_close` (puede tener pequeño penalty si no agotó el pool)
- **Pool agotado:** si todas las conversiones posibles ya se pagaron, el sistema cierra automáticamente

**Paso 5.2 — Snapshot del árbol**

El contrato hace snapshot del estado del árbol al momento del cierre:

- Todos los nodos
- Sus stakes
- Sus contadores de forks_descendientes
- Sus richness_scores
- Sus conversiones acumuladas
- Las hojas y sus paths

**Paso 5.3 — Iteración por conversiones**

Para cada conversión registrada, el contrato:

1. Identifica el `leaf_id`
2. Reconstruye el path genealógico completo: `[node_l1, node_l2, node_l3, leaf]`
3. Calcula el peso de cada nodo del path con la fórmula:

```
peso(nodo) = α × log(forks_descendientes + 1)
           + β × richness_score
           + γ × position_factor[nivel]
```

4. Suma los pesos del path
5. Para cada nodo del path, calcula su porción:

```
payout_individual = (peso_nodo / suma_pesos_path) × valor_conversion × (1 - platform_fee)
```

6. Acumula el payout en el balance del wallet correspondiente

**Paso 5.4 — Bonus para la hoja**

Después de calcular el payout base de la hoja, el contrato añade un bonus del 30% encima:

```
payout_final_hoja = payout_base_hoja × 1.30
```

Este bonus se descuenta proporcionalmente del pool restante (no afecta a los otros nodos del path).

**Paso 5.5 — Distribución de USDC**

El contrato ejecuta las transferencias de USDC desde el escrow a cada wallet con balance positivo:

- Wallets de creadores de nodos exitosos
- Wallets de creadores de hojas
- Wallet de plataforma (5% fee)

Estas transferencias son batch para eficiencia de gas.

**Paso 5.6 — Liberación de stakes**

El contrato evalúa cada stake:

- **Si el nodo (o sus descendientes) generaron al menos 1 conversión:** el stake se libera al creador junto con su payout
- **Si el nodo no generó nada:** el stake se queda en el sistema y se redistribuye según política configurada (devuelto a la marca, repartido entre nodos exitosos, o quemado)

**Paso 5.7 — Devolución de fondos no usados**

Si el pool de USDC no se agotó (porque hubo menos conversiones que las que cubría el presupuesto), el remanente vuelve al wallet de la marca.

**Paso 5.8 — Archivado y analytics**

El contrato marca la campaña como `Closed`. Toda la información del árbol queda permanentemente en el blockchain como referencia histórica:

- Qué nodos fueron exitosos
- Qué decisiones convirtieron mejor en este vertical
- Qué creators tuvieron mejor performance
- Qué patrones se repitieron

Este histórico es consultable por API y forma parte de la inteligencia de mercado pública.

### Output de la fase

- USDC distribuido a todos los participantes que contribuyeron
- Stakes liberados o redistribuidos según performance
- Marca con producto vendido y data de qué funcionó
- Árbol archivado como activo de inteligencia pública
- Reputación on-chain de cada participante actualizada

---

## Estados del árbol a lo largo del tiempo

| Tiempo | Estado | Características |
|--------|--------|-----------------|
| t=0 | Vacío | Solo root, link compartido |
| t=1 día | Inicial | 5-15 nodos en niveles 1-2, 0 hojas |
| t=2-3 días | Floreciente | 30-100 nodos, primeras hojas, primeras conversiones |
| t=1 semana | Maduro | Patrones emergiendo, ramas exitosas claras, forks abundantes |
| t=cierre | Estable | Crecimiento desacelera, optimización de hojas existentes |
| t=post-cierre | Archivado | Inmutable, referenciable por futuras campañas |

---

## Interacciones críticas entre actores

### Marca ↔ Smart contract

La marca solo interactúa con el contrato dos veces: al crear la campaña (deposit) y opcionalmente al cerrarla. Todo lo demás es observación. La interacción es fría, mínima, asíncrona.

### Creators ↔ Árbol

Los creators tienen ciclo continuo: crean nodos, ven cuáles funcionan, crean más nodos basados en lo que aprenden, forkean nodos ajenos exitosos. La interacción es caliente, frecuente, exploratoria.

### Agentes AI ↔ MCP ↔ Árbol

Los agentes operan vía MCP en background. Consultan el árbol, deciden contribuir, ejecutan transacciones, monitorean performance, ajustan estrategias. La interacción es automatizada, escalable, 24/7.

### Consumidor final ↔ Sistema

El consumidor nunca sabe que existe el sistema. Solo ve contenido en redes y clickea un link. La opacidad para él es intencional: la complejidad del sistema vive debajo, su experiencia es indistinguible de cualquier compra normal.

### Oracle ↔ Smart contract

El oracle es el puente entre el mundo off-chain (donde ocurren las conversiones reales) y el on-chain (donde se atribuyen y pagan). Su rol es crítico para la integridad del sistema. En MVP es centralizado; en V2 puede descentralizarse con múltiples oracles redundantes.

---

## Edge cases y manejo

### Caso: Nodo sin descendientes que convierten

Si alguien crea un nodo y nadie lo forkea ni lo usa en una hoja exitosa, el stake queda en el pool. La política por defecto es redistribuirlo entre los nodos exitosos del árbol al cierre.

### Caso: Hoja con múltiples conversiones

Una hoja puede generar muchas conversiones a lo largo de la campaña. Cada conversión activa una distribución independiente al path correspondiente. El balance del path se acumula.

### Caso: Conversión disputada

Si hay sospecha de fraude, la marca puede flaggear una conversión dentro de un periodo de gracia (típicamente 24 horas). El oracle verifica nuevamente. Si se confirma fraude, la conversión se revierte y el creator de la hoja pierde su stake.

### Caso: Marca quiere modificar parámetros mid-campaña

No se permite. Una vez la campaña inicia, los pesos de la fórmula y el criterio de conversión son inmutables. Esto protege a los participantes de cambios arbitrarios.

### Caso: Agente AI deshonesto crea nodos basura

El staking elimina la mayoría de este caso. Si el agente está dispuesto a quemar SOL en stakes que no convertirán, el sistema lo penaliza económicamente. Su track record on-chain se daña, dificultando futuras participaciones.

### Caso: Múltiples conversiones del mismo usuario

Por defecto, una sola conversión por usuario por campaña. El sistema verifica vía wallet, IP hash, fingerprint del navegador. Configuraciones especiales pueden permitir conversiones recurrentes (ej: suscripciones que pagan cada mes).

---

## Métricas de salud del flujo

### Para la marca

- ROI: USDC pagado vs valor de las conversiones generadas
- Costo por adquisición (CPA) efectivo
- Tasa de conversión por hoja
- Diversidad de creators participando

### Para los creators

- Payout total recibido
- Número de nodos creados que convirtieron
- Multiplicador efectivo (payout / stake invertido)
- Reputación on-chain acumulada

### Para la plataforma

- Volumen total de USDC procesado
- Número de árboles activos simultáneos
- Tiempo promedio entre creación de campaña y primera conversión
- Tasa de fraude detectada vs ejecutada

---

## Resumen del flujo en una frase

La marca deposita USDC y publica un árbol vacío. Humanos y agentes contribuyen nodos de decisiones de marketing, stakeando SOL para garantizar calidad. Creators eligen caminos del árbol, generan contenido, y publican con links únicos. Los consumidores compran a través de esos links. El smart contract atribuye cada conversión al árbol genealógico que la hizo posible y distribuye USDC proporcionalmente entre todos los que aportaron, premiando con bonus al creator del contenido final. Todo verificable, transparente, y composable.
