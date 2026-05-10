#!/usr/bin/env node
/**
 * Generate the 4 demo wallets the Group C frontend needs during the pitch:
 *   - brand_demo:  the brand that creates the campaign on stage
 *   - creator_1:   human creator that adds nodes during the demo
 *   - creator_2:   human creator that publishes the leaf
 *   - creator_3:   human creator that "buys" via /buy/[refCode] to trigger a conversion
 *
 * Each wallet is written as a Solana-compatible JSON file (array of 64 bytes
 * of secret key) into ./.local-keys/, which is gitignored. The pubkeys are
 * printed to stdout so we can paste them into COORDINATION.md and hand them
 * to Group A for pre-funding.
 *
 * Run from the web/ directory:  node scripts/gen-wallets.mjs
 *
 * SAFETY: never commit the .json files. Devnet only. If you accidentally
 * publish them, regenerate.
 */

import { Keypair } from "@solana/web3.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", ".local-keys");

const ROLES = ["brand_demo", "creator_1", "creator_2", "creator_3"];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

console.log("\n🐝  Hivework — generating 4 demo wallets (devnet)\n");
console.log("Role            | Pubkey");
console.log("----------------|" + "-".repeat(50));

const out = [];
for (const role of ROLES) {
  const path = join(OUT_DIR, `${role}.json`);
  if (existsSync(path)) {
    console.log(`${role.padEnd(15)} | (already exists, skipped — delete the file to regenerate)`);
    continue;
  }
  const kp = Keypair.generate();
  // Solana CLI keypair format: a JSON array of 64 unsigned bytes.
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`${role.padEnd(15)} | ${kp.publicKey.toBase58()}`);
  out.push({ role, pubkey: kp.publicKey.toBase58() });
}

console.log("\nKeypair files written to .local-keys/  (gitignored)");
console.log("\nPaste the pubkeys into COORDINATION.md → Wallets del Grupo C");
console.log("and hand them to Group A for pre-funding (5 SOL each + 100 USDC mock for brand_demo).\n");
