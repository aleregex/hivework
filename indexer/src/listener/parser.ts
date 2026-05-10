// Codama-aware parser stub. Until Grupo A ships the IDL and `npm run codama:generate`
// renders src/generated/anchor-client/, this returns []. After codegen, swap the
// import for the generated event decoder — handlers stay shape-compatible.
import type { AnchorEvent } from '../events.js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function parseAnchorEvents(_logs: readonly string[]): AnchorEvent[] {
  // TODO(post-IDL): import { parseHiveworkEvents } from '../generated/anchor-client/events.js'
  // return parseHiveworkEvents(_logs)
  return []
}
