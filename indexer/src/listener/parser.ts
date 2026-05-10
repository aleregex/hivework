// TODO: integrate Codama-generated event parser once Grupo A ships IDL.
// Plan: parseAnchorEvents(logs, idl) → typed events using @codama/renderers-js output.
export type AnchorEvent = { name: string; data: unknown }

export function parseAnchorEvents(_logs: readonly string[]): AnchorEvent[] {
  return []
}
