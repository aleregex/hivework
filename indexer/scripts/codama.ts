// Regenerate the Anchor client from Grupo A's IDL using Codama.
// Wired to a stable path: `programs/hivework/target/idl/hivework.json`.
// If the IDL doesn't exist yet, exit 0 with a clear warning so npm scripts
// downstream don't break.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const IDL_PATH = resolve(process.cwd(), '..', 'programs', 'hivework', 'target', 'idl', 'hivework.json')
const OUT_DIR = resolve(process.cwd(), 'src', 'generated', 'anchor-client')

async function main() {
  if (!existsSync(IDL_PATH)) {
    console.warn(`[codama] IDL not found at ${IDL_PATH} — skipping codegen.`)
    console.warn('[codama] Re-run after Grupo A ships the program: `npm run codama:generate`')
    return
  }

  // Lazy-load codama deps so a missing IDL doesn't force devDependency installs.
  const [{ rootNodeFromAnchor }, { renderVisitor }, { createFromRoot }] = await Promise.all([
    import('@codama/nodes-from-anchor'),
    import('@codama/renderers-js'),
    import('codama'),
  ])

  const idl = JSON.parse(readFileSync(IDL_PATH, 'utf8'))
  const codama = createFromRoot(rootNodeFromAnchor(idl))
  codama.accept(renderVisitor(OUT_DIR))
  console.log(`[codama] generated → ${OUT_DIR}`)
}

main().catch((e) => {
  console.error('[codama] generation failed', e)
  process.exit(1)
})
