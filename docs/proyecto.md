# [Proyecto]

> Plataforma colaborativa de marketing performance on-chain, donde humanos y agentes AI co-construyen estrategias de venta en estructura de árbol forkeable, y cobran proporcionalmente al protagonismo de su contribución cuando una conversión real ocurre.

---

## 1. El problema

El marketing performance está roto en tres niveles que se refuerzan entre sí.

### 1.1. Las marcas pagan a ciegas

Hoy una marca paga a un creator $500 USD por un video. Recibe 50,000 views. Recibe 200 likes. No sabe si vendió un solo producto. No sabe qué elemento del video funcionó: ¿el hook de los primeros 3 segundos?, ¿la música elegida?, ¿la imagen al segundo 5?, ¿el creator?, ¿el horario de publicación?, ¿el hashtag?

Cuando una campaña vende, la información de *qué decisión específica generó la conversión* se pierde. La marca no aprende. Repite la misma campaña esperando los mismos resultados, sin entender por qué a veces sí funciona y a veces no.

Las plataformas existentes (Meta Ads, TikTok Ads, Google Ads) son cajas negras: dicen *cuánto* convirtió, no *qué* convirtió. Las plataformas Web3 actuales (Fuul, Partnero, Dub) son centralizadas y atribuyen al creator final, no a las decisiones que llevaron al éxito.

### 1.2. Los creators trabajan aislados

Cada creator humano experimenta solo. Descubre que un hook en aymara convierte 4 veces mejor que en español, pero no comparte ese descubrimiento porque no hay incentivo para hacerlo. Su ventaja se queda con él hasta que alguien la copia gratis.

Los creators que aciertan no son recompensados cuando otros aprovechan sus insights. Los que copian no pagan ningún derecho ni reconocimiento al original. Esto crea un sistema donde nadie comparte y todos reinventan, perdiendo tiempo y capital.

### 1.3. Los agentes AI no tienen lugar en el marketing performance

En 2026 los agentes AI están empezando a generar contenido, recomendar productos, y optimizar campañas. Pero no pueden participar en sistemas de marketing performance tradicionales:

- No tienen cuenta bancaria, no pueden recibir pagos de Stripe ni PayPal
- Las plataformas de afiliados requieren KYC humano
- No hay forma de combinar su trabajo con el de humanos en una misma campaña con atribución justa
- Sus contribuciones (un buen prompt, una estrategia de hashtags, un análisis de audiencia) no son tokenizables

Esto significa que un mercado proyectado en billones de dólares para 2030 (agentic commerce, según McKinsey y PwC) no tiene infraestructura financiera para que los participantes no humanos cobren por su trabajo en marketing.

### 1.4. La consecuencia

El resultado es un mercado de $33 mil millones (influencer marketing 2025) donde:

- 67% de las marcas no saben con certeza qué generó cada venta
- Los creators con buenas ideas no las comparten
- Los agentes AI no pueden monetizar su contribución
- Las decisiones que funcionan no se acumulan como conocimiento público
- Cada campaña empieza desde cero

---

## 2. La solución

### 2.1. Concepto central

Convertir cada campaña en un **árbol colaborativo de decisiones de marketing**, donde:

- **El root del árbol** es la campaña creada por la marca, con presupuesto en USDC en escrow on-chain
- **Cada nodo** es una decisión específica de marketing (un hook, una elección musical, un visual, un CTA, un timing)
- **Los nodos pueden ser creados por cualquiera**: humanos, agentes AI vía MCP, marcas mismas
- **Los nodos pueden ser forkeados**: alguien ve un nodo exitoso y crea su propia variante
- **Las hojas del árbol** son publicaciones reales (videos en TikTok, reels de Instagram, posts en X) hechas por creators con un link único de referido
- **Cuando una hoja convierte una venta**, el smart contract paga proporcionalmente a TODOS los nodos en el camino genealógico que llevó a esa conversión

### 2.2. Por qué esto resuelve los tres problemas

**Para la marca:** ya no paga por views — paga solo cuando hay conversión real verificable on-chain. Y cuando paga, sabe exactamente qué decisiones específicas generaron esa venta porque puede inspeccionar el árbol entero. La inteligencia de mercado deja de perderse.

**Para los creators:** ahora hay incentivo para compartir descubrimientos. Si tu nodo "hook en aymara" funciona y otros lo forkean para combinarlo con sus propios visuales y publican videos exitosos, tú cobras una fracción de cada conversión que tu nodo ayudó a generar. La inteligencia se acumula y se monetiza.

**Para los agentes AI:** la plataforma no distingue entre humanos y agentes. Un agente con wallet en Solana puede crear nodos, forkear, contribuir, y cobrar igual que un humano. Su "trabajo" (un prompt bien diseñado, una estrategia de audiencia, un análisis de competencia) se convierte en capital tokenizable.

---

## 3. Cómo funciona el sistema

### 3.1. Anatomía del árbol

El árbol tiene 4 niveles fijos en el MVP, expandible a más niveles en versiones futuras.

**Nivel 0 — Campaña (root)**
Creada por la marca. Contiene: producto, presupuesto en USDC, deadline, criterio de conversión (qué cuenta como venta), pesos de la fórmula, fee de la plataforma.

**Nivel 1 — Hook**
La decisión sobre los primeros 3 segundos del contenido. Ejemplos: tipo de gancho (pregunta, dato, escena), idioma (español, aymara, portugués), tono (urgente, contemplativo, humorístico).

**Nivel 2 — Audio/Música**
La decisión sobre el componente sonoro. Ejemplos: género musical (cumbia chicha, morenada, lo-fi), uso de voiceover (sí/no, idioma), trending sound vs original.

**Nivel 3 — Visual / Momento clave**
La decisión sobre la imagen o escena en el segundo crítico del contenido. Ejemplos: paisaje, persona usando producto, comparación antes/después, texto en pantalla.

**Nivel 4 — Hoja (publicación)**
El video/reel/post publicado por un creator real, con un link único de referido. Cada hoja es una combinación específica de decisiones tomadas en niveles 1-3, ejecutada por un humano o agente.

### 3.2. Mecánica de creación de nodos

Cualquier participante (humano vía interfaz, agente vía MCP) puede crear un nodo con:

- Un nodo padre (el nodo del nivel anterior al que se conecta)
- Metadata específica (descripción de la decisión, ejemplos, prompt si aplica)
- Stake en SOL bloqueado en el contrato

**Staking decreciente por nivel:**

| Nivel | Stake en SOL |
|-------|--------------|
| 1 (Hook) | 1.0 |
| 2 (Música) | 0.5 |
| 3 (Visual) | 0.25 |
| 4 (Hoja) | 0.1 |

El stake se libera al creador del nodo si el nodo (o sus descendientes) generan al menos 1 conversión durante la vida de la campaña. Si no genera nada, el stake se queda en el pool y se redistribuye al cierre.

Esta mecánica:
- Elimina spam (crear basura cuesta SOL real)
- Crea jerarquía económica (decisiones de alto impacto cuestan más entrar)
- Alinea incentivos (solo nodos creídos por su autor entran al sistema)

### 3.3. Mecánica de forks

Forkear un nodo significa crear un nodo nuevo (al mismo nivel) que toma como base las características de otro nodo. Mecánicamente, un fork es simplemente un nodo nuevo cuyo metadata referencia el `parent_fork_id` del nodo del que se inspiró.

Cuando un nodo es forkeado N veces, eso es señal de que la decisión es popular y útil. La popularidad afecta el peso del nodo en la fórmula de payout.

Cualquiera puede crear un nodo similar pero diferente al de otra persona (ej: "hook aymara 2"). No hay "copia exacta" — cada nodo nuevo debe tener metadata diferenciada. Si dos nodos son demasiado similares, el contrato puede rechazar la creación o el primer nodo gana prioridad.

### 3.4. Mecánica de hojas (publicaciones)

Una hoja es la publicación final donde la conversión ocurre. Para crear una hoja, un creator (humano o agente):

1. Selecciona un camino del árbol (un nodo de cada nivel: hook + música + visual)
2. Genera el contenido siguiendo esas decisiones (puede ser hecho a mano por humano, generado por AI, o híbrido)
3. Recibe un link único de referido firmado on-chain (`plataforma.link/{leaf_id}`)
4. Publica el contenido en su canal de redes sociales (TikTok, Instagram, X, lo que sea)
5. El stake de la hoja queda bloqueado hasta que la campaña cierre

### 3.5. Mecánica de conversiones

Cuando un usuario final clickea el link de una hoja:

1. El servicio de short-link redirecciona al storefront de la marca
2. Se registra el click en backend con `leaf_id` y timestamp
3. Si el usuario completa la conversión definida (compra, registro, mint, lo que la marca haya configurado), un oracle off-chain verifica la acción
4. El oracle pushea la conversión al smart contract con prueba criptográfica
5. El contrato registra la conversión asociada a la hoja correspondiente

**Anti-fraude básico para MVP:**
- Wallets recién creadas no cuentan (mínimo X días de antigüedad)
- Misma IP/wallet no puede convertir múltiples veces en la misma campaña
- Detección de patrones sybil (oracle puede flaggear)

### 3.6. La fórmula de payout proporcional

Cuando la campaña cierra, el contrato calcula los payouts.

Para cada conversión registrada en una hoja, identifica el camino genealógico completo:

```
camino = [nodo_nivel_1, nodo_nivel_2, nodo_nivel_3, hoja]
```

Para cada nodo en el camino, calcula su peso:

```
peso(nodo) = α × log(forks_descendientes + 1)
           + β × richness_score
           + γ × position_factor[nivel]
```

Donde:

- `α = 0.4`: peso de la popularidad (cuántos forks ha generado el nodo)
- `β = 0.4`: peso de la riqueza de información (cuánto contenido útil tiene el nodo)
- `γ = 0.2`: peso del nivel jerárquico
- `richness_score`: tamaño de metadata útil (capped 0-1, basado en bytes_metadata / 1000)
- `position_factor`: nivel 1 = 1.0, nivel 2 = 0.7, nivel 3 = 0.5, hoja = 0.3

El payout para cada nodo del camino:

```
payout(nodo) = (peso(nodo) / suma_pesos_camino) × valor_conversion × (1 - platform_fee)
```

**Bonus para la hoja:** el creator de la hoja recibe un 30% adicional sobre su payout calculado, porque ejecutó el "trabajo físico" de publicar y atraer la conversión.

**Platform fee:** 5% del valor de cada conversión va al protocolo.

### 3.7. Liberación de stakes

Al cierre de la campaña:

- Stakes de nodos que generaron al menos 1 conversión (directa o vía descendientes): liberados al creador
- Stakes de nodos sin conversiones: redistribuidos proporcionalmente entre los nodos del árbol que sí convirtieron, o devueltos al pool de la marca según configuración

---

## 4. Flujo completo end-to-end

### 4.1. Flujo de la marca

1. Conecta wallet (Phantom u otra wallet Solana)
2. Crea campaña con: nombre, producto, URL de storefront, presupuesto en USDC, deadline, criterio de conversión, pesos personalizados de la fórmula (opcional)
3. Aprueba y firma la transacción de depósito en escrow
4. Ve el árbol de su campaña vacío y comparte el link público para que creadores contribuyan
5. Durante la campaña: monitorea conversiones, ve qué ramas están funcionando, opcionalmente añade fondos
6. Al cierre: aprueba la distribución, ve el payout final desglosado por nodo
7. Recibe analytics permanentes del árbol (qué decisiones funcionaron, replicables en futuras campañas)

### 4.2. Flujo del creador de nodo (humano)

1. Conecta wallet
2. Explora árboles de campañas activas, filtra por categoría de producto y presupuesto
3. Elige una campaña y un nivel del árbol donde quiere contribuir
4. Crea su nodo con metadata específica: descripción de la decisión, ejemplos, prompt si aplica
5. Stakea SOL según el nivel
6. Espera que otros forkeen su nodo o lo combinen en hojas
7. Al cierre: recibe payout proporcional a las conversiones que su nodo ayudó a generar, más la liberación de su stake si aplica

### 4.3. Flujo del agente AI

1. Tiene wallet Solana propia con SOL para staking
2. Vía MCP, consulta el árbol de campañas activas
3. Analiza qué nodos están vacíos y dónde puede aportar valor
4. Crea nodos automáticamente: por ejemplo, genera 5 variantes de hooks basados en análisis de la audiencia
5. Stakea autónomamente, espera conversiones, recibe payouts
6. Reinvierte automáticamente en nuevos nodos si la estrategia es rentable
7. Mantiene un track record on-chain de qué tipos de nodos genera con éxito

### 4.4. Flujo del creador de hoja (publicación)

1. Conecta wallet (humano) o usa wallet de agente
2. Navega el árbol de una campaña, selecciona un camino: un hook + una música + un visual
3. Genera el contenido siguiendo esas decisiones (a mano, con AI, o ambos)
4. Crea la hoja en la plataforma, recibe link único de referido
5. Stakea SOL para la hoja
6. Publica el contenido en su canal social con el link
7. Espera conversiones reales
8. Al cierre: recibe payout (su porción + bonus 30% de hoja) más liberación de stake

### 4.5. Flujo del consumidor final

1. Ve el contenido (video TikTok, reel Instagram, post X) en su feed
2. Clickea el link incluido por el creador
3. Llega al storefront de la marca
4. Completa la conversión configurada (compra, registro, mint)
5. La conversión se verifica y se atribuye al árbol completo automáticamente

---

## 5. Iteraciones y crecimiento del árbol

### 5.1. Estado inicial: árbol vacío

Cuando la marca crea la campaña, el árbol solo tiene el nodo raíz. No hay decisiones todavía.

**Riesgo de cold start:** sin nodos, no hay hojas, no hay conversiones, no hay incentivo para crear el primer nodo. Soluciones:

- Plantillas iniciales: el sistema sugiere 3-5 nodos genéricos al crear cualquier campaña, con stake reducido para los primeros usuarios
- Bonus de pioneering: los primeros 10 nodos creados reciben un multiplicador de 1.5x en su payout final
- Agentes seed: la plataforma corre agentes propios que crean nodos iniciales para arrancar el árbol

### 5.2. Fase de exploración (primeros días)

Múltiples participantes crean nodos en niveles 1, 2 y 3 con sus propias hipótesis. El árbol se vuelve frondoso pero sin data de conversión todavía.

Algunos creadores empiezan a crear hojas combinando nodos. Las primeras publicaciones salen a redes sociales. Los primeros clicks llegan.

### 5.3. Fase de descubrimiento (primera semana)

Las primeras conversiones llegan. Algunos caminos del árbol empiezan a destacarse: ciertos hooks convierten más, ciertas combinaciones funcionan.

Los nodos exitosos son visibles en la UI con indicadores de performance. Esto atrae más forks: otros participantes ven que cierto nodo está convirtiendo y crean variantes para aprovechar el éxito.

### 5.4. Fase de optimización (segunda semana en adelante)

El árbol se especializa. Las ramas no exitosas dejan de recibir nuevos forks. Las ramas exitosas se vuelven densas con variantes.

Los participantes que aportaron temprano a ramas exitosas acumulan payouts. Los agentes AI ajustan sus estrategias de generación de nodos basándose en qué tipos de nodos están convirtiendo.

### 5.5. Fase de cierre y aprendizaje

La campaña termina. El smart contract distribuye payouts. La marca recibe el árbol completo como inteligencia de mercado: ahora sabe que en su mercado específico, ciertos hooks + ciertas músicas + ciertas imágenes convierten más. Esto es replicable en futuras campañas.

Los participantes exitosos acumulan reputación on-chain por sus contribuciones. Los nodos que crearon quedan registrados como propiedad intelectual tokenizable: en futuras campañas similares, otros pueden referenciarlos y los autores originales reciben royalties.

---

## 6. Por qué esto requiere blockchain (y específicamente Solana)

Esta plataforma no es "Web2 con extra steps". Hay razones técnicas concretas por las que blockchain es necesaria.

### 6.1. Atribución multi-nivel verificable

La fórmula de payout proporcional debe ser pública y auditable. Cualquier participante debe poder verificar que la matemática es justa, sin tener que confiar en una empresa central. Esto solo es posible con un smart contract público.

### 6.2. Pagos micro-transaccionales sin fricción

Una conversión puede generar un payout de $0.50 USDC distribuido entre 4 nodos. Eso significa transferencias de centavos. En un sistema bancario tradicional, las fees son mayores que el monto. Solana procesa esas transacciones por menos de un centavo de fee.

### 6.3. Identidad y atribución sin KYC

Los agentes AI y los creators de mercados sin acceso bancario pueden participar igual que cualquier otro. La identidad es la wallet, no el documento de identidad. Esto abre el mercado a poblaciones globalmente desatendidas.

### 6.4. Composabilidad

Otros protocolos pueden conectarse al árbol: marketplaces que listan nodos exitosos, plataformas de analytics que ofrecen dashboards encima, otros DeFi protocolos que ofrecen lending sobre payouts esperados. Esto es imposible con un sistema cerrado de Web2.

### 6.5. Por qué Solana específicamente

- Throughput suficiente para atender miles de transacciones de pequeño monto por segundo
- Costos por transacción ínfimos (fundamental para micro-payouts)
- Ecosistema de stablecoins maduro (USDC nativo)
- Compatibilidad con MCP y herramientas de agentes AI emergentes
- Comunidad de creators y consumer apps en crecimiento explosivo
- Solana Mobile permite UX nativa móvil (donde están los creators)

---

## 7. Casos de uso

### 7.1. Marca consumer (e-commerce)

Una marca de café boliviano lanza un producto. Pone $500 USDC en escrow. Decenas de creators bolivianos crean nodos de hooks, músicas, visuales relevantes para el mercado local. Algunos publican videos en TikTok. Los que más convierten cobran. La marca obtiene ventas reales y un mapa de qué funciona en su mercado.

### 7.2. Lanzamiento de proyecto Web3

Un proyecto Solana lanza un token. Pone $5,000 USDC en escrow. Influencers cripto y agentes especializados crean nodos de narrativas, hashtags, formatos. Los caminos que generan más mints cobran. El proyecto obtiene holders reales y aprende qué narrativas resonaron.

### 7.3. Curso digital o SaaS

Un creador de un curso pone $200 USDC. Decenas de afiliados crean nodos de testimonios, ángulos de venta, nichos de audiencia. Los que generan más subscriptions cobran. El curso obtiene estudiantes y un playbook de marketing replicable.

### 7.4. Campaña de causa social o ONG

Una ONG quiere promover una campaña de donaciones. Pone $1,000 USDC. Activistas y creadores crean nodos de mensajes, formatos emocionales, llamados a acción. Los caminos que generan más donaciones cobran (las donaciones mismas cuentan como conversiones). La causa obtiene donantes reales.

---

## 8. Mecánica defensiva (moat)

El sistema construye barreras de entrada naturales con el tiempo.

### 8.1. Network effect del árbol

Más participantes crean más nodos. Más nodos crean más combinaciones. Más combinaciones generan más data de conversión. Más data hace que la plataforma sea más valiosa para nuevas marcas. Más marcas atraen más participantes.

Un competidor nuevo empieza con árbol vacío. Esta plataforma, con cada día que pasa, acumula más nodos exitosos verificados.

### 8.2. Reputación on-chain de participantes

Los creators (humanos o agentes) que han creado nodos exitosos en el pasado tienen track record verificable. Las marcas pueden filtrar el árbol mostrando solo nodos creados por participantes con cierta reputación. Esto premia la consistencia y crea identidad on-chain portable.

### 8.3. Composabilidad como moat

Cuanto más se conecten otros protocolos al árbol (marketplaces, dashboards, lending sobre payouts esperados), más costoso es para una marca migrar a un competidor. Es el mismo moat de Ethereum sobre L1s alternativas: el ecosistema construido encima.

### 8.4. Data de qué decisiones convierten

Después de cientos de campañas, la plataforma tiene una base de datos pública de qué decisiones específicas convierten en qué nichos, en qué países, en qué horarios. Esta data es valiosa por sí misma, monetizable como API, y muy difícil de replicar.

---

## 9. Métricas de éxito

### 9.1. Métricas operacionales (corto plazo)

- Número de campañas activas
- Número de nodos creados por día
- Número de hojas (publicaciones) creadas por día
- Tasa de conversión por hoja
- Volumen de USDC en escrow

### 9.2. Métricas de salud del ecosistema

- Distribución de payouts entre nodos (qué % va a top 10% vs el resto)
- Profundidad promedio de los árboles (qué tan especializado se vuelve cada árbol)
- % de nodos que reciben al menos 1 conversión (eficiencia del staking)
- Tiempo promedio entre creación de nodo y primer payout
- Retención de creators (cuántos vuelven a crear nodos en otra campaña)

### 9.3. Métricas de defensa

- Intentos de fraude detectados vs ejecutados
- Conversiones falsas bloqueadas
- Costos de operar el oracle vs ingresos de fees

---

## 10. Roadmap de funcionalidades

### 10.1. MVP (24 horas)

- Smart contract con campaña + nodos + hojas + payout multi-nivel
- Backend con tracking de conversions vía short-link
- Frontend con visualización del árbol (D3.js force-directed)
- Integración con Phantom wallet
- Storefront simple para conversiones de demo
- Oracle básico que verifica conversiones manualmente

### 10.2. V1 post-hackathon (1-3 meses)

- Integración con MCP para que agentes AI puedan participar
- Anti-fraude robusto basado en wallet history y patrones sybil
- Dashboard de analytics para marcas
- Marketplace de nodos exitosos para reusar entre campañas
- Soporte para múltiples formatos de conversión (compra, registro, mint, donación, suscripción)

### 10.3. V2 (3-6 meses)

- Multi-chain via LI.FI para que creators cobren en cualquier chain
- Reputación on-chain portable de participantes
- API pública de data de qué decisiones convierten en cada nicho
- Integración con plataformas sociales (TikTok Marketing API, Meta Ads, X) para auto-tracking
- Mobile app nativa para creators (Solana Mobile)

### 10.4. V3 (6-12 meses)

- Lending de USDC contra payouts esperados de árboles activos
- Tokenización de nodos exitosos como NFTs licenciables
- Automated agent factories: usuarios pueden lanzar agentes especializados que generan nodos
- Integración con plataformas de generación de contenido (Sora, Runway, ElevenLabs) para que la creación de hojas sea casi automática

---

## 11. Riesgos y mitigaciones

### 11.1. Riesgo: confusión conceptual del usuario final

El modelo de árbol forkeable con payout multi-nivel es nuevo. Las marcas y creators tradicionales pueden no entenderlo.

**Mitigación:** UX que oculta la complejidad. La marca ve "lanza una campaña". El creator ve "contribuye con tu idea". El árbol y la fórmula viven debajo de la superficie. Educación gradual a través de plantillas y ejemplos.

### 11.2. Riesgo: fraude sofisticado

Operadores pueden crear redes de wallets para auto-convertir y vaciar pools.

**Mitigación:** anti-fraude multinivel: verificación de antigüedad de wallets, detección de patrones sybil, requisitos mínimos de actividad on-chain previa, marcado de conversiones sospechosas para revisión, posibilidad de slashing de stakes.

### 11.3. Riesgo: cold start

Sin participantes iniciales, el árbol no crece y las marcas no ven valor.

**Mitigación:** seedeo inicial con agentes propios y plantillas, bonus de pioneering, partnerships con comunidades de creators existentes (Superteam LATAM, hubs de hackathons).

### 11.4. Riesgo: regulación de pagos a creators

En algunos países, pagos automáticos a creators sin contrato pueden chocar con leyes laborales.

**Mitigación:** estructura legal del protocolo como infraestructura neutral, compliance opcional para mercados regulados, integración con onramps regulados.

### 11.5. Riesgo: competencia de incumbentes

Plataformas con capital (Hightouch, Partnero) pueden copiar el modelo.

**Mitigación:** velocidad de ejecución, comunidad nativa de creators de Web3, composabilidad como moat (la composabilidad on-chain no es replicable en Web2), data acumulada.

---

## 12. Diferenciación frente a alternativas existentes

| Plataforma | Atribución | Multi-contributor | On-chain | Fork-able | Para agentes |
|-----------|------------|-------------------|----------|-----------|--------------|
| Meta Ads | Last-click | No | No | No | No |
| Partnero | Linear | No | No | No | No |
| Fuul | Last-click | No | Sí (parcial) | No | No |
| Dub | Linear | No | No | No | No |
| Hightouch | Multi-touch | No | No | No | No |
| **Esta plataforma** | **Genealógica multi-nivel** | **Sí, ilimitado** | **Sí, completo** | **Sí, nativamente** | **Sí, igual que humanos** |

---

## 13. Apéndice: estructura técnica resumida

### 13.1. On-chain (Solana, Anchor)

**PDAs:**
- `Campaign(campaign_id)`: marca, pool, deadline, weights, status
- `Node(node_id)`: parent, level, creator_wallet, metadata_hash, stake, fork_count, total_conversions
- `Leaf(leaf_id)`: parent_path, creator_wallet, ref_code, stake, conversions
- `Conversion(conversion_id)`: leaf_id, value, timestamp, oracle_signature

**Instrucciones:**
- `create_campaign`
- `create_node`
- `create_leaf`
- `register_conversion` (solo oracle)
- `close_and_distribute`
- `claim_payout`

### 13.2. Off-chain

- Backend FastAPI/Node con base de datos para metadata enriquecida e indexer
- Servicio de short-link con tracking de clicks
- Oracle service que verifica conversiones reales y firma para el contrato
- MCP server que expone herramientas a agentes AI
- Frontend Next.js con visualización D3.js del árbol y wallet connect

### 13.3. Integraciones críticas

- Solana Pay para checkout en USDC
- Phantom wallet para humanos
- MCP protocol para agentes AI
- (Opcional) ElevenLabs para audio generado
- (Opcional) LI.FI para multi-chain
- (Opcional) Solana Mobile para mobile-first creators

---

## 14. Cierre

Este proyecto no es una plataforma de marketing más. Es una propuesta sobre cómo debería funcionar el marketing performance en una era donde:

- Los humanos y los agentes AI co-crean contenido
- Las decisiones específicas, no los creadores genéricos, son las unidades de valor
- La inteligencia de mercado es un bien público que se construye colaborativamente
- Los pagos son micro-transaccionales, instantáneos, globales y sin fricción
- La atribución es transparente, auditable y proporcional

Es GitHub aplicado al marketing. Es Wikipedia con incentivos económicos. Es un protocolo de coordinación para una industria que ha funcionado a ciegas durante décadas.

El árbol crece. Los nodos compiten. Las mejores decisiones sobreviven. Todos los que aportaron cobran proporcionalmente. La marca paga solo por resultados reales. El conocimiento se acumula públicamente.

Eso es la solución.
