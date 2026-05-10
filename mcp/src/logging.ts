function summarize(args: unknown): string {
  if (args === undefined || args === null) return "{}";
  try {
    const json = JSON.stringify(args);
    return json.length > 240 ? `${json.slice(0, 237)}...` : json;
  } catch {
    return "[unserializable]";
  }
}

export function logToolCall(name: string, args: unknown): void {
  const ts = new Date().toISOString();
  console.log(`[mcp:tool] ${ts} ${name} args=${summarize(args)}`);
}

export function logToolError(name: string, err: unknown): void {
  const ts = new Date().toISOString();
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[mcp:tool] ${ts} ${name} error=${message}`);
}
