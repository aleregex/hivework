# Grupo C — Frontend completo, visualización del árbol, pitch, demo y submission

> Tu trabajo es ser la cara visible del proyecto. Construyes toda la UI por la que pasan los usuarios, eres dueño de la visualización del árbol que es el corazón del demo, y eres responsable del pitch y la submission. Eres también quien levanta el scaffold inicial del que parten los demás. Sin tu trabajo, no hay demo, no hay submission, no hay pitch.

---

## Lo que hay que entregar

### 1. Scaffold inicial del proyecto ✅ (ya hecho)

El scaffold de Next.js ya está creado en `web/` y el repo es monorepo plano:

```
hivework/
├── web/         ← Frontend Next.js (Grupo C)
├── api/         ← Backend + MCP server (Grupo B)
└── contracts/   ← Smart contract Anchor (Grupo A)
```

El scaffold viene de `create-solana-dapp` con Next 16 + React 19 + Tailwind 4. Migrado a stack clásico para que integre directo con el IDL de Anchor del Grupo A:

- `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` + `@solana/wallet-adapter-wallets` (Phantom, Solflare, Backpack)
- `@solana/web3.js`
- `@coral-xyz/anchor` (consume el IDL nativo)
- Conexión a devnet ya seteada

### 2. Frontend completo

Una aplicación Next.js que cubre todos los flujos del sistema:

**Landing pública**
- Hero con propuesta de valor clara
- Cómo funciona en 3 pasos visuales
- CTA principal: "Lanzar campaña" / "Explorar campañas"
- Sección con campañas activas destacadas

**Vista de marca**
- Formulario multi-step para crear campaña: nombre, producto, presupuesto, deadline, criterio de conversión, configuración de pesos
- Confirmación visual antes de firmar la transacción
- Dashboard con campañas activas e históricas
- Vista detallada de campaña con árbol y métricas

**Vista del árbol (componente central del producto)**
- Visualización con D3.js o react-force-graph
- Nodos clickeables con sidepanel de detalle
- Diferenciación visual clara entre niveles (color, tamaño, posición jerárquica)
- Animaciones suaves cuando se crea un nodo nuevo, se forkea, o llega una conversión
- Indicadores visibles de performance (cuántas conversiones ha generado cada nodo)
- Distinción visual entre nodos creados por humanos y por agentes AI
- Updates en tiempo real vía WebSocket o polling al backend

**Vista de creator (humano)**
- Explorar campañas activas con filtros
- Vista del árbol completo de una campaña
- Botón "Crear nodo" con formulario contextual al nivel
- Botón "Crear hoja" con selector visual de path (elegir un nodo de cada nivel)
- Confirmación con detalles del stake antes de firmar
- Portfolio personal: nodos creados, hojas activas, payouts esperados, payouts cobrados

**Vista de "compra" del demo**
- Página simple que aparece cuando alguien clickea un short-link
- Muestra el producto, el creator que lo recomendó, y un botón "Comprar"
- Al comprar, llama al endpoint del backend que dispara el flujo de conversión
- Confirmación visual de que la compra se registró

**Vista de claim**
- Lista de campañas donde el wallet conectado tiene balance
- Botón de claim por cada una
- Historial de claims previos
- Total acumulado lifetime

### 3. Animación de cascada de USDC al cierre

Cuando una campaña cierra y se distribuyen los pagos, el frontend muestra una animación visualmente impactante:

- USDC fluye desde el escrow central hacia los nodos
- Cada nodo del árbol se ilumina al recibir su parte
- Contador en cada nodo subiendo desde 0 hasta su payout final
- Sonido de "ka-ching" sutil en cada distribución
- Resumen final con total distribuido, top creators, top nodos

Este es el momento wow del demo. Sin esto, el demo no se diferencia.

### 4. Pitch y demo

- **Pitch deck** de 8-10 slides: problema, solución, cómo funciona, demo, mercado, equipo, roadmap
- **Script del demo** línea por línea, ensayado al menos 5 veces
- **Video backup** de 2-3 minutos grabado del flujo completo funcionando, en caso que falle algo en vivo
- **README del repo** con descripción, arquitectura, cómo correr localmente, equipo
- **Página landing pública** con info, deck, demo video, contacto

### 5. Submission completa

- Submission a Dev3pack con video, deck, repos, descripción
- Aplicar a tracks aplicables: Solana principal (obligatorio), x402 si hay integración, Solana Mobile si hay versión móvil
- Submission separada a Colosseum Accelerator como side track ($250k + $2M en seed funding)
- Twitter/X presence el día del demo: thread con highlights, tags a sponsors

---

## La visualización del árbol — detalle crítico

Esto es el centro del producto y del demo. Vale la pena gastar tiempo extra haciéndola bien.

**Estructura visual sugerida:**

- **Root (campaña)** en el centro o en la parte superior, con tamaño distintivo
- **Nivel 1 (hooks)** como ramas grandes que salen del root
- **Nivel 2 (música)** como sub-ramas saliendo de cada hook
- **Nivel 3 (visuales)** como sub-sub-ramas
- **Hojas (publicaciones)** como las puntas del árbol, con miniaturas del contenido si es posible

**Codificación visual:**

- Color por nivel (mantener consistente)
- Tamaño del nodo proporcional a forks descendientes (popularidad)
- Brillo/glow proporcional a conversiones generadas (performance)
- Líneas más gruesas en ramas que tienen más actividad
- Badge especial en nodos creados por agentes AI

**Animaciones clave:**

- Aparición suave de nodos nuevos (fade-in con scale)
- Pulso cuando llega una conversión (el nodo "respira")
- Cascada de USDC al cierre (lo más importante)

**Performance:**

- Hasta 100-200 nodos debe ser fluido
- Si pasa de 500, considerar virtualizacion o agrupamiento

---

## Lo que necesitas de otros grupos

### Del Grupo A (Smart contract)

- **IDL del programa** lo antes posible para construir transacciones desde el frontend
- **Pubkey del programa en devnet** para configurar la conexión
- **Ejemplos de transacciones serializadas** para cada acción (crear campaña, crear nodo, etc). Esto te ahorra horas de figuring out cómo armar txs.
- **Lista de errores custom** con códigos y mensajes para mostrar feedback útil al usuario
- **Wallets pre-fundeadas** en devnet con SOL para staking durante el demo

### Del Grupo B (Backend)

- **Documentación de APIs** apenas estén disponibles, aunque sea con respuestas mockeadas. Sin esto no puedes avanzar.
- **Ejemplos concretos de respuestas JSON** para cada endpoint. Necesitas estos antes que las APIs estén funcionando para diseñar la UI.
- **WebSocket o SSE** para updates en tiempo real del árbol cuando el agente AI crea nodos durante el demo
- **URL del MCP server y descripción** para mencionar en el pitch técnico
- **Endpoint del demo** que recibe la "compra" cuando el usuario clickea "Comprar" en el frontend

### Cosas que necesitas pedir explícitamente al inicio

- ¿Cómo se autentica el frontend al backend? (wallet signature como JWT es lo estándar)
- ¿Qué wallets de prueba se van a usar para el demo? Definirlas con todos los grupos
- ¿Decisión final sobre el dominio? Esto afecta al short-link service
- ¿Hay diseñador o diseñas tú mismo? Si no hay, partir de un componentes library (shadcn/ui) y no perder tiempo en diseño from scratch

---

## Lo que tienes que entregar a los otros grupos

### Al Grupo A

- **Lista de wallets de prueba** que necesitan estar pre-fundeadas en devnet
- **Casos de uso específicos del demo** para que A pueda hacer un script de seed que pre-pueble una campaña con datos iniciales si hace falta para ensayar

### Al Grupo B

- **Especificación de qué necesitas en cada respuesta de API** (campos exactos, estructura)
- **Eventos del frontend que el backend debería trackear** (ej: clicks que no son de short-links, sino navegación interna)
- **Decisión sobre si hay flujos custodial** (ej: para creators sin wallet, ¿el backend les crea una?)

### A todos

- **Repo del scaffold inicial** compartido en las primeras horas
- **Branch strategy clara** (main protegido, develop como integración, branches por feature)
- **Schedule de ensayos del demo** los grupos A y B también deben estar para validar que su parte funciona

---

## Stack y herramientas (decidido)

- **Framework:** Next.js 16 con App Router (viene del scaffold, React 19)
- **Estilos:** Tailwind 4 + shadcn/ui (no perder tiempo en CSS custom)
- **Wallet:** `@solana/wallet-adapter-react` + UI + wallets (Phantom, Solflare, Backpack)
- **Solana SDK:** `@solana/web3.js` + `@coral-xyz/anchor` (consume IDL del Grupo A)
- **Visualización del árbol:** `react-force-graph-2d` (decidido — más rápido que D3 puro)
- **Animaciones:** `framer-motion` para transiciones y la cascada USDC
- **Charts (dashboard de marca):** `recharts`
- **Estado:** `@tanstack/react-query` para server state, `zustand` para client state si hace falta
- **Notificaciones:** `sonner`
- **Deploy:** Vercel (1 click desde GitHub, deploy temprano en hora 0-1)

---

## Sobre el pitch y demo

### Estructura sugerida del pitch (3 minutos)

**Segundos 0-20: Gancho con el problema**
Una frase que duela. Un número que sorprenda. Por ejemplo: "Las marcas en LATAM gastan $2 mil millones en influencer marketing cada año, y el 67% no sabe si funcionó. Vamos a arreglar eso."

**Segundos 20-50: Solución en una frase + visualización**
Mostrar el árbol vacío. Explicar la idea central: "Cada campaña es un árbol donde humanos y agentes AI co-construyen estrategias. Solo se paga por conversiones reales, distribuidas proporcionalmente a quien aportó."

**Segundos 50-130: Demo en vivo**
La marca crea la campaña. Aparecen nodos (creados por humanos del equipo y por el agente AI). Se publican hojas con links únicos. Llegan conversiones. El árbol crece en vivo en pantalla. Cierre con la cascada de USDC distribuyéndose.

**Segundos 130-160: La defensa**
Por qué Solana específicamente, por qué blockchain es necesaria, qué no se puede hacer en Web2. Mencionar el MCP y los agentes AI como diferenciador.

**Segundos 160-180: El cierre**
Visión a futuro, mercado, llamado a la acción. "Marketing es código ahora. El árbol crece. Las mejores decisiones sobreviven. Todos los que aportan cobran. En Solana."

### Lo que debe mostrar el demo

- Crear campaña con USDC real moviéndose en Solscan
- Al menos 5-10 nodos en el árbol antes de empezar (pre-poblados o creados al inicio)
- Un agente AI creando nodos en vivo durante el demo (esto es crítico)
- Conversiones llegando en tiempo real (miembros del equipo o cómplices del público comprando)
- Cierre con animación de cascada y payouts visibles en Solscan

### Errores comunes a evitar

- Demos largos: 3 minutos no es 5
- Explicar la fórmula matemática en pantalla (los jueces no quieren matemáticas, quieren ver dinero moviéndose)
- Demos sin "humanos haciendo cosas" (si todo es automatizado se siente frío)
- No tener video backup (algo siempre falla)
- Demos donde no se ve el resultado on-chain en Solscan (es la prueba de que es real)

---

## Riesgos a vigilar

**1. Estás esperando APIs que no llegan.** Plan B: trabajar con mocks desde la hora 0. Cuando B entregue APIs reales, solo cambias el endpoint. Si esperas a que estén listas, pierdes 4-5 horas.

**2. La visualización del árbol consume todo el tiempo.** Plan B: empezar con una versión muy simple (lista anidada, o tree con líneas SVG básicas). Iterar a force-graph solo si hay tiempo. Una visualización funcional simple supera a una ambiciosa rota.

**3. Las wallets no firman en el momento del demo.** Plan B: tener wallets de respaldo, conexión a internet redundante, y haber probado el flujo completo al menos 5 veces antes del demo.

**4. El pitch se sale de tiempo.** Plan B: ensayar con cronómetro estricto. 3 minutos significa 3 minutos. Si pasa de 3:30, perdiste atención de los jueces.

**5. La animación de cascada se ve mal.** Plan B: si no logras hacerla bien, sustituir por highlights secuenciales (cada nodo se ilumina por turnos mostrando su payout). Es menos wow pero efectivo.

---

## Definición de "done" para tu grupo

- [ ] Scaffold inicial creado y compartido en hora 0
- [ ] Landing page deployada y accesible
- [ ] Wallet connect funcionando con Phantom
- [ ] Flujo completo de creación de campaña funciona end-to-end
- [ ] Vista del árbol renderiza correctamente con datos reales
- [ ] Creación de nodo y hoja funciona desde la UI
- [ ] Animación de cascada de USDC implementada y testeada
- [ ] Vista de "compra" del demo dispara conversión correctamente
- [ ] Claim de payouts funciona
- [ ] Pitch deck completo
- [ ] Video backup grabado y editado
- [ ] README del repo claro y completo
- [ ] Submission a Dev3pack completa con todos los tracks aplicables
- [ ] Submission a Colosseum enviada
- [ ] Twitter thread preparado para publicar el día del demo
- [ ] Demo ensayado al menos 5 veces sin errores
