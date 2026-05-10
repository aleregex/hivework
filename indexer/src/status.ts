// Cross-module shared state for /healthz. Mutated by the listener, read by the
// health server. Keeping it in a tiny module avoids coupling them directly.

export const listenerStatus = {
  connected: false,
}
