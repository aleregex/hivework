# Instrucciones para arrancar — Hivework

> Lee esto si formas parte del equipo de Hivework. Te dice exactamente qué hacer en los primeros 30 minutos para empezar a construir tu parte sin chocar con los demás.

---

## Antes de leer otra cosa

1. Únete al canal de Telegram/Discord del equipo (link en `COORDINATION.md`)
2. Clona el repo: `git clone [URL]`
3. Lee `CLAUDE.md` en la raíz (5 minutos) — contexto general del proyecto
4. Identifica tu grupo (A, B, o C) y lee `docs/grupo_X.md` correspondiente (10 minutos)

Después de eso, vuelve aquí.

---

## Setup individual de Claude Code

Cada uno de nosotros usa su propia consola de Claude Code, pero todos cargamos los mismos MDs como contexto base. Esto asegura que todos los Claude entienden el proyecto igual.

### Verificar Claude Code instalado

```bash
claude --version
```

Si no:

```bash
npm install -g @anthropic-ai/claude-code
```

### Posicionarse en el repo

```bash
cd hivework/
```

### Iniciar Claude Code

```bash
claude
```

---

## Primer prompt según tu grupo

Copia y pega exactamente este prompt como tu primer mensaje a Claude Code, ajustando solo el grupo que te toque.

### Si eres del Grupo A (Smart contract + Oracle)

```
Soy el dueño del Grupo A en una hackathon de Solana de 12 horas. El proyecto se llama Hivework.

Antes de hacer nada, lee estos archivos en orden:
1. CLAUDE.md (contexto general)
2. docs/grupo_a.md (mis tareas específicas)
3. COORDINATION.md (wallets, decisiones compartidas)

Mi stack: Anchor framework + Rust. El scaffold ya está levantado con create-solana-dapp.

Mi prioridad #1 es definir las structs y PDAs del programa Anchor en programs/hivework/src/lib.rs:
- Campaign (root del árbol)
- Node (con parent, level, stake, fork_count, conversions_count)
- Leaf (con path al árbol, ref_code, stake)
- Conversion (firmada por oracle)

Antes de codear:
1. Lista los archivos que vas a crear o modificar
2. Muéstrame el outline de las structs propuestas
3. Confirma qué seeds vas a usar para cada PDA
4. Explica cómo vas a serializar el path genealógico

No empieces hasta que confirme.

Mi objetivo en las primeras 4 horas: tener el IDL provisional listo para entregar a Grupos B y C, aunque las instrucciones aún no estén implementadas en su totalidad.
```

### Si eres del Grupo B (Backend + MCP + Agente AI)

```
Soy el dueño del Grupo B en una hackathon de Solana de 12 horas. El proyecto se llama Hivework.

Antes de hacer nada, lee estos archivos en orden:
1. CLAUDE.md (contexto general)
2. docs/grupo_b.md (mis tareas específicas)
3. COORDINATION.md (wallets, decisiones compartidas)

Mi stack: [completar — FastAPI Python o Express Node, lo que prefieras]. Voy a crear una carpeta apps/api/ dentro del monorepo o un repo separado.

Mi prioridad #1 es:
1. Definir el modelo de datos off-chain (campaigns_metadata, nodes_metadata, leaves_metadata, clicks, pending_conversions)
2. Crear endpoints HTTP base (apenas con respuestas mockeadas) para que el Grupo C pueda integrar en paralelo
3. Setup del MCP server skeleton para que el agente AI pueda conectarse después

Antes de codear:
1. Lista los archivos que vas a crear
2. Muéstrame el schema de la base de datos propuesto
3. Lista las APIs HTTP que vas a exponer con un ejemplo JSON de cada respuesta
4. Confirma si vas con SQLite (más rápido) o PostgreSQL (más serio)

No empieces hasta que confirme.

Mi objetivo en las primeras 4 horas: tener el backend deployado con APIs base respondiendo (aunque sea con datos mockeados) y el MCP server skeleton corriendo localmente.
```

### Si eres del Grupo C (Frontend + Pitch + Submission)

```
Soy el dueño del Grupo C en una hackathon de Solana de 12 horas. El proyecto se llama Hivework. Yo levanté el scaffold con create-solana-dapp.

Antes de hacer nada, lee estos archivos en orden:
1. CLAUDE.md (contexto general)
2. docs/grupo_c.md (mis tareas específicas)
3. COORDINATION.md (wallets, decisiones compartidas)

Tema: abejas y colmenas 🐝. Color sugerido: amarillo #F5C518 sobre negro #0A0A0A, acento naranja #FF6B35.

Mi prioridad #1 es la landing page con:
- Hero con tagline "Marketing is teamwork. Pay only for the honey."
- Una frase impactante sobre el problema del marketing performance roto
- Sección "Cómo funciona" en 3 pasos visuales
- CTA: "Lanzar campaña" / "Explorar campañas"
- Sección con campañas activas (placeholder por ahora)

Antes de codear:
1. Lista los archivos que vas a crear o modificar en apps/web/
2. Dame un mockup ASCII rápido del layout de la landing
3. Confirma que vas a usar shadcn/ui para componentes base
4. Sugiere qué animaciones agregar para que se sienta vivo

No empieces hasta que confirme.

Mi objetivo en las primeras 4 horas: tener landing deployada en Vercel + skeleton de las vistas críticas (creación de campaña, vista de árbol con datos mock).
```

---

## Reglas de oro para trabajar con Claude Code en este proyecto

### 1. Siempre mostrar plan antes de codear

Antes de cada tarea grande, pídele a Claude que liste qué archivos va a tocar y por qué. Si te parece sensato, dile "ok, procede". Si no, ajustas. Esto evita 80% de los re-trabajos.

### 2. Commit después de cada componente funcional

```bash
git add .
git commit -m "feat(grupo-X): descripción de qué se logró"
git push
```

Cada hora, mínimo un commit. Si pasa más de hora sin commit, algo está mal.

### 3. Si Claude se atora con errores

No insistas. Pídele que:
1. Pause
2. Lea el error completo
3. Liste hipótesis de qué podría estar mal
4. Investigue antes de codear

A veces necesita ver el archivo, a veces necesita correr un comando de debug. Dale espacio.

### 4. Cada 2 horas, sync con el equipo

Postea en el canal:
- Qué terminé
- Qué estoy haciendo ahora
- Qué necesito de otro grupo

Esto destraba más rápido que reuniones.

### 5. Cuando entregas algo a otro grupo

Posteas en el canal con:
- Link al commit
- Qué incluye exactamente
- Cómo se prueba/usa
- Qué limitaciones tiene

Sin esto, los demás van a usarlo mal y vas a perder tiempo explicando 1-a-1.

---

## Lista de archivos que ya están en el repo

Después de levantar el scaffold y agregar los MDs, esto es lo que TODOS deberían ver:

```
hivework/
├── CLAUDE.md                    ← Lee primero
├── COORDINATION.md              ← Wallets y decisiones compartidas
├── README.md                    ← README público (Grupo C lo pulirá al final)
├── INSTRUCCIONES.md             ← Este archivo
├── docs/
│   ├── proyecto.md              ← Idea completa del producto
│   ├── flujo_trabajo.md         ← Flujo end-to-end del sistema
│   ├── grupo_a.md               ← Tareas detalladas del Grupo A
│   ├── grupo_b.md               ← Tareas detalladas del Grupo B
│   └── grupo_c.md               ← Tareas detalladas del Grupo C
├── programs/
│   └── hivework/                ← Smart contract (Grupo A)
└── apps/
    ├── web/                     ← Frontend (Grupo C)
    └── api/                     ← Backend (Grupo B, opcional aquí)
```

Si no ves alguno de estos archivos, avisa en el canal.

---

## Si te bloqueas

**Reglas de escalación:**

1. Intenta solo por 15 minutos
2. Si sigues bloqueado, pregunta en el canal del equipo (no esperes 1 hora)
3. Si nadie responde en 10 minutos, intenta workaround temporal y deja un TODO claro
4. NUNCA te quedes 2 horas atascado en silencio

El tiempo es el recurso más caro. Mejor pedir ayuda que perder horas.

---

## Lista de chequeo antes de empezar a codear

Antes de tu primer commit, verifica:

- [ ] Cloné el repo
- [ ] Leí `CLAUDE.md` y entiendo el proyecto general
- [ ] Leí mi `docs/grupo_X.md` y entiendo mis tareas
- [ ] Estoy en el canal del equipo
- [ ] Sé las pubkeys de los otros grupos en `COORDINATION.md`
- [ ] Inicié Claude Code en el repo
- [ ] Le di a Claude el primer prompt de mi grupo
- [ ] Claude leyó los MDs y confirmó entender el contexto
- [ ] Tengo plan claro de las primeras 4 horas

Si todo está marcado, listo. Empezás a construir.

---

## Recordatorio final

No estamos construyendo un producto perfecto. Estamos construyendo un demo que gana.

Cuando dudes entre "hacerlo bien" y "hacerlo demoable", elige demoable. La perfección viene en V1, post-hackathon.

Velocidad sobre elegancia. Demo sobre código. Funcional sobre escalable.

Buena suerte 🐝
