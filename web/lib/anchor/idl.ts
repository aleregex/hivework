// Re-exports the Anchor IDL JSON with a typed `as const` so the program
// factory in program.ts gets typed `methods`. The JSON file is the canonical
// source of truth — copied from Contract/idl/hivework.json on each release.

import idlJson from "./idl/hivework.json";
import type { Idl } from "@coral-xyz/anchor";

export const HIVEWORK_IDL = idlJson as Idl;
export const HIVEWORK_PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
  "8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8";
