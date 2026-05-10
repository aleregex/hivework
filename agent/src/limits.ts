import { PERSONA_NAME } from "./persona.js";
import { STAKE_SOL_BY_LEVEL, type NodeLevel } from "./plan-schema.js";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_NODES_PER_WINDOW = 5;
const MAX_SOL_PER_SESSION = 3.0;

type Counters = {
  nodesCreatedInWindow: number;
  windowStartMs: number;
  solStakedSession: number;
};

const counters: Counters = {
  nodesCreatedInWindow: 0,
  windowStartMs: Date.now(),
  solStakedSession: 0,
};

function rollWindow(now: number): void {
  if (now - counters.windowStartMs >= WINDOW_MS) {
    counters.nodesCreatedInWindow = 0;
    counters.windowStartMs = now;
  }
}

export type GateDecision =
  | { ok: true }
  | { ok: false; reason: "rate_limit"; retryAfterMs: number };

export function gateBeforeCreate(level: NodeLevel): GateDecision {
  const now = Date.now();
  rollWindow(now);

  const stake = STAKE_SOL_BY_LEVEL[level];
  if (counters.solStakedSession + stake > MAX_SOL_PER_SESSION) {
    console.error(
      `[${PERSONA_NAME}:agent watchdog] SOL cap exceeded — would stake ${stake} SOL on top of ${counters.solStakedSession.toFixed(2)} SOL session total (cap ${MAX_SOL_PER_SESSION}). Exiting.`,
    );
    process.exit(1);
  }

  if (counters.nodesCreatedInWindow >= MAX_NODES_PER_WINDOW) {
    return {
      ok: false,
      reason: "rate_limit",
      retryAfterMs: counters.windowStartMs + WINDOW_MS - now,
    };
  }

  return { ok: true };
}

export function recordCreated(level: NodeLevel): void {
  counters.nodesCreatedInWindow += 1;
  counters.solStakedSession += STAKE_SOL_BY_LEVEL[level];
}

export function snapshotCounters(): Readonly<Counters> {
  return { ...counters };
}
