# `Contract/` — Hivework Solana Program (Anchor)

> **The only place where money moves.** An Anchor program that custodies USDC escrow per campaign, locks SOL anti-spam stakes, attests to conversions through a per-campaign oracle, and distributes payouts proportionally along the genealogical path that produced each sale.

[![Solana devnet](https://img.shields.io/badge/Solana-devnet-9945FF?logo=solana&logoColor=white)](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet)
[![Anchor 1.0](https://img.shields.io/badge/anchor-1.0.2-blue)](https://www.anchor-lang.com)
[![Rust 2021](https://img.shields.io/badge/rust-edition--2021-orange?logo=rust)](https://www.rust-lang.org)
[![Status: deployed](https://img.shields.io/badge/status-deployed%20%E2%9C%93-success)](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet)

---

## ✅ Demo-ready proof

| What | Value |
|---|---|
| **Program ID (devnet)** | [`8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8`](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet) |
| **Oracle authority (demo)** | `FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU` |
| **IDL** | [`idl/hivework.json`](./idl/hivework.json) — SHA-256 `a80dde10f5e2905e…` |
| **End-to-end test** | [`tests/hivework.ts`](./tests/hivework.ts) — full happy path: create campaign → 3-level tree → leaf → conversion → close → forfeit → claims → redistribution |
| **Reference oracle** | [`oracle/`](./oracle/) — Express service that signs `register_conversion` |
| **On-chain LOC** | **1,030 lines** of Rust (12 instructions, 4 account types, 6 events, 18 typed errors) |

Anything quoted in this README can be verified directly against `programs/hivework/src/` — no claims are aspirational.

---

## 60-second tour for reviewers

1. **What is on-chain?** USDC escrow, SOL stakes, the genealogical path of every leaf, and the payout math. See [What this program is](#what-this-program-is).
2. **How does attribution work?** Each leaf carries an immutable `[L1, L2, L3]` path of node pubkeys. When the oracle attests a conversion, the program walks that path and credits each ancestor proportionally. See [Worked example](#worked-example-100-usdc-conversion).
3. **What stops spam?** Every creator locks SOL at creation. If their subtree produces zero conversions, the stake is forfeited to a pool that legitimate creators share. See [Anti-spam economics](#anti-spam-economics-positive-sum-by-design).
4. **What stops fraud?** Only the campaign's pre-declared `oracle_authority` can call `register_conversion`. The constraint is enforced at the Anchor account level — no signer, no conversion. See [Security model](#security-model).
5. **How do I run it?** [Build & deploy](#build--deploy).

---

## What this program is

Hivework's on-chain program is the **only place where money moves**. Every other service (`api/`, `indexer/`, `mcp/`, `web/`, `agent/`) is glue around this binary. Its role is narrow and load-bearing:

- **Custody.** Holds the brand's USDC in a campaign-scoped escrow ATA from `create_campaign` until close.
- **Stake locking.** Every node and leaf creator locks SOL at creation; lamports are released only if the node (or any descendant) produces ≥ 1 conversion.
- **Attribution.** The genealogical path `[L1, L2, L3]` is written into every leaf account, immutable and auditable.
- **Attestation gate.** Only the campaign's pre-declared `oracle_authority` can call `register_conversion`. No conversion can be forged by participants.
- **Payout math.** Computes the proportional weight of each ancestor and distributes USDC with a 5% platform fee and a 30% leaf bonus.
- **Anti-spam economics.** Loser stakes are forfeited to a pool that winners share proportionally — turning spammers into fundraisers for legitimate creators.

---

## Security model

Why a judge can trust the demo end-to-end:

| Concern | Mitigation | Where in code |
|---|---|---|
| Forged conversions | `register_conversion` requires `oracle: Signer` whose pubkey must equal `campaign.oracle_authority` (recorded at `create_campaign` time). Anchor's `address = ...` constraint enforces this; the transaction is rejected at deserialization. | `lib.rs` — `RegisterConversion` context |
| Double-spending a conversion | Each `Conversion` is its own PDA seeded by `[b"conversion", campaign, leaf, conversion_id_16]`. The same id cannot create the account twice; `is_processed` further guards against re-distributing the same conversion. | `lib.rs:close_and_distribute`, `errors.rs:ConversionAlreadyRegistered` |
| Metadata tampering | `metadata_hash` is signed on-chain at `create_node`/`create_leaf` time. The off-chain `api/` row is committed via its SHA-256 — the indexer rejects any record whose hash drifts. | `state.rs:Node.metadata_hash` |
| Escrow theft | The escrow ATA's authority is the `Campaign` PDA itself. Funds can only leave via this program's own instructions, regardless of who signs `close_and_distribute` or `claim_payout`. | `lib.rs` — every USDC `Transfer` uses `with_signer(&[&campaign_seeds])` |
| Integer overflow / underflow | All payout math uses `checked_*` / `saturating_*` and computes in `u128`. The `overflow-checks = true` profile is set in `Cargo.toml`. | `lib.rs:calc_weight`, `lib.rs:close_and_distribute` |
| Reentrancy | Not possible: Solana's runtime forbids re-entering a program with a borrowed account in the same call stack. | n/a |
| Permissionless cleanup | Anyone may call `close_and_distribute`, `forfeit_*`, and `claim_redistribution` post-deadline. This is safe because account authorities are PDAs and the math is deterministic; openness merely removes the brand as a liveness dependency. | `lib.rs` — `Anyone` rows in the instruction table |

**Known limitation (called out honestly).** The current `register_conversion` trusts the oracle keypair holistically; there is no separate ed25519 signature of the conversion payload sitting beside the tx. For mainnet, the path is to add an ed25519 sysvar verification of a signed `{campaign, leaf, value, conversion_id, nonce}` blob, which would also enable gasless conversion submission. For the hackathon, the keypair *is* the trust anchor and the on-chain check is sufficient.

---

## How it integrates with the rest of the system

```
   web/  +  agent/   ─── sign Anchor txs ────►   Hivework program   ◄─── register_conversion
                                                        │  ▲                       │
                                                        │  │                       │
        emits 6 events  ───────────────►                │  │  reads accounts       │  signs with
        CampaignCreated, NodeCreated,                   │  │  via getAccountInfo   │  oracle keypair
        LeafCreated, ConversionRegistered,              │  │                       │
        CampaignClosed, PayoutClaimed                   ▼  │                       │
                                                  Solana devnet                    │
                                                        │  ▲                       │
                                                        ▼  │                       │
                                  ┌─────────────────────────────────────┐          │
                                  │              indexer/               │          │
                                  │   • listener (Codama-decoded logs)  │ ─────────┘
                                  │   • oracle poller (signs txs)       │
                                  └─────────────────┬───────────────────┘
                                                    ▼
                                            Postgres (Neon)
                                                    ▲
                                                    │
                                                api/  ── reads tree, writes drafts
                                                    ▲
                                                    │
                                             web/  +  mcp/
```

**Integration contracts:**

| Counterparty | Reads | Writes |
|---|---|---|
| `web/` (`lib/anchor/`) | All account types via Anchor codegen | `create_campaign`, `create_node`, `create_leaf`, `claim_payout`, `claim_leaf_payout` |
| `agent/` via `mcp/` | `Campaign`, `Node`, `Leaf` | `create_node`, `create_leaf` (signed by the agent's own wallet) |
| `indexer/` listener | All program logs (Codama-decoded) | _(read-only)_ |
| `indexer/` oracle / `Contract/oracle/` | `Leaf`, `Campaign` | `register_conversion` (only authorized signer) |
| Anyone (post-deadline) | `Campaign`, `Node`, `Leaf`, `Conversion` | `close_campaign`, `close_and_distribute`, `forfeit_*`, `withdraw_unused_usdc`, `claim_redistribution` |

The IDL at [`idl/hivework.json`](./idl/hivework.json) is the **wire contract**. The frontend types its client from it, the indexer generates its event decoder from it via Codama, and the MCP server uses it to build unsigned transactions for AI agents.

---

## Project layout

```
Contract/
├── programs/hivework/src/
│   ├── lib.rs           # 12 instructions + contexts + payout math (~1030 LOC)
│   ├── state.rs         # 4 account types: Campaign, Node, Leaf, Conversion
│   ├── constants.rs     # Stakes, fees, default α/β/γ, position factors, PDA seeds
│   ├── errors.rs        # 18 typed errors (codes 6000–6017)
│   └── events.rs        # 6 events emitted on every state transition
├── tests/
│   └── hivework.ts      # End-to-end happy-path test suite (Mocha + Anchor)
├── oracle/              # Reference HTTP oracle service — see oracle/README.md
├── idl/
│   └── hivework.json    # Generated IDL — the wire contract for B and C
├── target/              # Anchor build artifacts (gitignored)
│   ├── idl/hivework.json
│   └── deploy/hivework.so
├── Anchor.toml
├── Cargo.toml
└── INTEGRATION.md       # Step-by-step integration guide for B and C
```

---

## Account model

Four PDA account types. All seeds are derivable off-chain so clients can compute addresses without an RPC roundtrip.

| Account | Seeds | Key fields |
|---|---|---|
| `Campaign` | `["campaign", authority, campaign_id_u32_le]` | `escrow_usdc` ATA, `usdc_mint`, `oracle_authority`, `alpha/beta/gamma`, `deadline`, `is_closed`, `total_conversions`, `conversions_processed`, `forfeited_pool`, `total_to_winners`, `unused_withdrawn` |
| `Node` | `["node", campaign, creator, metadata_hash_32]` | `level` (1/2/3), `parent_node`, `metadata_hash`, `bytes_metadata`, `stake_locked`, `forks_count`, `conversions_count`, `claimable_usdc` |
| `Leaf` | `["leaf", campaign, ref_code_8_ascii]` | `genealogical_path: [Pubkey; 3]`, `ref_code`, `bytes_metadata`, `stake_locked`, `conversions_count`, `claimable_usdc`, `redistribution_claimed` |
| `Conversion` | `["conversion", campaign, leaf, conversion_id_16]` | `oracle`, `value`, `is_processed` |

`metadata_hash` on `Node` is the **SHA-256 of the canonical JSON** stored in `api/`'s Postgres. The hash is signed on-chain; the metadata itself lives off-chain but is tamper-evident.

---

## Instructions

12 instructions total. The "Caller" column shows who is *authorized* to sign — anything marked **Anyone** is open by design (the math is deterministic and the PDA holds custody, so opening these to the world only improves liveness).

| # | Instruction | Caller | Purpose |
|---|---|---|---|
| 1 | `create_campaign` | Brand | Initializes Campaign PDA + escrow ATA, accepts initial USDC, sets weights + deadline + oracle |
| 2 | `create_node` | Anyone | Creates an L1/L2/L3 node, locks the level-appropriate stake, validates the parent chain |
| 3 | `create_leaf` | Anyone | Publishes a leaf, validates the `[L1, L2, L3]` path against on-chain nodes, locks the leaf stake |
| 4 | `register_conversion` | **Oracle only** | Records a verified sale. `oracle: Signer` constraint enforces that only the campaign's pre-declared oracle pubkey can call this |
| 5 | `close_campaign` | Anyone (post-deadline) | Marks the campaign closed and emits `CampaignClosed`. Idempotent. |
| 6 | `close_and_distribute` | Anyone (post-deadline) | Processes one conversion per call: computes weights and credits `claimable_usdc` to ancestors and leaf |
| 7 | `forfeit_node_stake` | Anyone (post-close) | Loser nodes (`conversions_count == 0`) forfeit stake to the redistribution pool |
| 8 | `forfeit_leaf_stake` | Anyone (post-close) | Same for leaves |
| 9 | `claim_payout` | Node creator | Withdraws accumulated USDC + releases stake if winner |
| 10 | `claim_leaf_payout` | Leaf creator | Same for leaves, with the +30% leaf bonus already accumulated |
| 11 | `withdraw_unused_usdc` | Brand | After all conversions processed, brand reclaims any leftover escrow |
| 12 | `claim_redistribution` | Winning leaf creator | Proportional share of the forfeited-stake pool |

### `create_campaign` signature

```ts
program.methods
  .createCampaign(
    deadline,        // i64 — unix seconds, must be > now
    alpha,           // u8  — must sum to 100 with beta + gamma
    beta,            // u8
    gamma,           // u8
    campaignId,      // u32 — small per-authority counter
    initialUsdc,     // u64 — base units (6 decimals for USDC)
    metadataCuid,    // string — ≤ 32 chars, joins on-chain ↔ api row
  )
  .accounts({
    campaign:               campaignPda,
    usdcMint,
    escrowUsdc,             // ATA derived from (campaignPda, usdcMint)
    authorityUsdc,          // brand's USDC ATA — source of escrow funds
    authority,
    oracleAuthority,        // pubkey allowed to sign register_conversion
    tokenProgram,
    associatedTokenProgram,
    systemProgram,
    rent,
  })
```

**Validations** (any failure aborts the tx):

- `alpha + beta + gamma == 100` → `InvalidWeights` (6011)
- `deadline > now` → `InvalidDeadline` (6012)
- `initial_usdc > 0` → `InsufficientFunds` (6007)
- `metadata_cuid.len() ≤ 32` → `DataTooLarge` (6010)

### `claim_payout` / `claim_leaf_payout`

```ts
program.methods.claimPayout().accounts({
  node: nodePda,
  campaign: campaignPda,    // signs the CPI to transfer escrow USDC
  escrowUsdc,
  creatorUsdc,              // creator's USDC ATA (destination)
  creator,
  tokenProgram,
})
```

---

## Economic constants

All values live in [`programs/hivework/src/constants.rs`](./programs/hivework/src/constants.rs).

### Stakes (devnet calibration)

The stakes are calibrated for **devnet usability**, not mainnet economics. At SOL ≈ $160 these values land between $0.01 and $0.10 — enough to throttle mass spam without making genuine participation expensive on a testnet. Mainnet values would scale up; the program reads from these constants only.

| Level | Stake (lamports) | Stake (SOL) | Approx. USD | Rationale |
|---|---|---|---|---|
| L1 (hook)   | `600_000` | 0.0006 SOL  | ≈ $0.10  | Hardest to do well; highest reward potential |
| L2 (audio)  | `300_000` | 0.0003 SOL  | ≈ $0.05  | |
| L3 (visual) | `150_000` | 0.00015 SOL | ≈ $0.025 | |
| Leaf        | `60_000`  | 0.00006 SOL | ≈ $0.01  | Lowest, but earns a +30% bonus on each conversion |

### Fees & bonuses

| Constant | Value |
|---|---|
| `PLATFORM_FEE_PERCENTAGE` | 5% |
| `LEAF_BONUS_PERCENTAGE` | 30% |

### Default payout weights

The brand can override these per campaign at `create_campaign`. They must sum to 100.

| Constant | Default | Meaning |
|---|---|---|
| `α` | 40 | Popularity (log of descendant fork count) |
| `β` | 40 | Information richness (metadata bytes capped at 1 KB) |
| `γ` | 20 | Hierarchical position |

Position factors (`γ` multiplier) are stored ×10 on-chain:

| Level | Factor |
|---|---|
| L1 | 1.0 |
| L2 | 0.7 |
| L3 | 0.5 |
| Leaf | 0.3 |

---

## The on-chain payout formula

```
weight(node) = α × ln(descendant_forks + 1)
             + β × min(bytes_metadata / 1000, 1.0)
             + γ × position_factor[level]
```

`ln(x)` is approximated as `ilog2(x) × ln(2)` with integer scaling — Solana does not allow floats. The approximation is monotonic and sufficient for a *relative* weighting; absolute magnitudes do not matter because every recipient is normalized against `total_weight`.

### Distribution per conversion

1. Subtract the 5% platform fee.
2. Reserve 30% of the remainder as the leaf bonus.
3. Split the remaining 65% across `{L1, L2, L3, Leaf}` proportionally to weights.
4. The leaf creator receives `leaf_weight_share + 30% bonus`.

---

## Worked example: 100 USDC conversion

Assume default weights (α=40, β=40, γ=20) and the following tree state when the oracle attests a conversion worth **100 USDC**:

| Level | `forks_count` | `bytes_metadata` |
|---|---|---|
| L1   | 8 | 800 B |
| L2   | 4 | 600 B |
| L3   | 2 | 400 B |
| Leaf | – | 500 B |

Per-node weights (in internal scaled units):

| Level | `α·log` | `β·richness` | `γ·position` | **weight** |
|---|---|---|---|---|
| L1   | 831 720 | 320 000 | 200 000 | **1 351 720** |
| L2   | 554 480 | 240 000 | 140 000 |   **934 480** |
| L3   | 277 240 | 160 000 | 100 000 |   **537 240** |
| Leaf |       0 | 200 000 |  60 000 |   **260 000** |
| | | | **total** | **3 083 440** |

Payout breakdown:

| Recipient | Calculation | USDC |
|---|---|---|
| Platform fee | `100 × 5%` | **5.00** |
| Distributable pool | `100 − 5` | 95.00 |
| Leaf bonus reserve | `95 × 30%` | 28.50 |
| Shared pool | `95 − 28.50` | 66.50 |
| → L1 creator   | `66.50 × 1 351 720 / 3 083 440` | **≈ 29.15** |
| → L2 creator   | `66.50 ×   934 480 / 3 083 440` | **≈ 20.15** |
| → L3 creator   | `66.50 ×   537 240 / 3 083 440` | **≈ 11.58** |
| → Leaf creator | `66.50 ×   260 000 / 3 083 440 + 28.50` | **≈ 34.11** |
| **Conservation** | sum of payouts + fee | **100.00 USDC ✓** |

The leaf author ends up the single largest recipient (~34%), even though their `γ·position` factor is the lowest — because the 30% bonus is what aligns *publishing* (the only act that actually generates the conversion) with *ownership*.

---

## Anti-spam economics (positive-sum by design)

After `close_campaign`:

- Anyone may call `forfeit_node_stake` / `forfeit_leaf_stake` on accounts with `conversions_count == 0` and `stake_locked > 0`. The stake moves to `Campaign.forfeited_pool`.
- Each winning leaf may call `claim_redistribution` **once** to withdraw `pool × leaf.conversions_count / campaign.total_conversions` lamports.
- **Design choice:** only leaves participate in redistribution, not nodes. Every conversion increments exactly one leaf, giving clean proportionality. Winning nodes recover their full stake via `claim_payout`.

The net effect: **spammers fund the people who actually shipped.** A campaign that attracts spam doesn't pay a deadweight cost; the spam becomes a tip pool for the winners.

---

## Events

All events flow through the Solana log stream and are decoded by `indexer/` via Codama bindings.

| Event | Fields |
|---|---|
| `CampaignCreated` | `campaign`, `authority`, `total_usdc`, `deadline`, `metadata_cuid` |
| `NodeCreated` | `node`, `campaign`, `creator`, `level`, `parent_node`, `stake_lamports`, `metadata_cuid` |
| `LeafCreated` | `leaf`, `campaign`, `creator`, `ref_code`, `path`, `stake_lamports`, `metadata_cuid` |
| `ConversionRegistered` | `conversion`, `campaign`, `leaf`, `value`, `conversion_id` |
| `CampaignClosed` | `campaign`, `conversions_processed` |
| `PayoutClaimed` | `campaign`, `source`, `creator`, `kind` (Node \| Leaf), `amount_usdc`, `stake_released_lamports` |

The `metadata_cuid` field on `*Created` events is what lets the indexer match an on-chain account back to its `api/` draft row without a side-channel.

---

## Errors

18 typed errors with codes 6000–6017. Surface them in the frontend as user-facing messages.

| Code | Name | Meaning |
|---|---|---|
| 6000 | `CampaignClosed` | Campaign already closed |
| 6001 | `CampaignNotClosed` | Campaign deadline not yet reached |
| 6002 | `UnauthorizedOracle` | Caller is not the campaign's oracle authority |
| 6003 | `InvalidLevel` | Level must be 1, 2, or 3 |
| 6004 | `InvalidParentNode` | Parent does not match expected level / campaign |
| 6005 | `InvalidGenealogicalPath` | Leaf path doesn't reference the right L1/L2/L3 nodes of this campaign |
| 6006 | `InsufficientStake` | Lamports transferred do not match required stake |
| 6007 | `InsufficientFunds` | No funds available to claim |
| 6008 | `MathError` | Saturating math caught an overflow |
| 6009 | `ConversionAlreadyRegistered` | This conversion was already distributed (idempotency guard) |
| 6010 | `DataTooLarge` | Metadata cuid exceeds 32 chars |
| 6011 | `InvalidWeights` | α + β + γ ≠ 100 |
| 6012 | `InvalidDeadline` | Deadline is in the past |
| 6013 | `NodeIsWinner` | Only nodes with zero conversions can be forfeited |
| 6014 | `NoStakeToForfeit` | No stake remains to forfeit |
| 6015 | `RedistributionAlreadyClaimed` | Leaf already claimed its pool share |
| 6016 | `PendingConversions` | `withdraw_unused_usdc` blocked: conversions still unprocessed |
| 6017 | `UnusedAlreadyWithdrawn` | Brand already reclaimed the unused USDC |
| 6018 | `NoUnusedUsdc` | No unused USDC remains in escrow |

---

## Build & deploy

### Prerequisites

- Rust + Cargo
- Solana CLI: `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`
- Anchor CLI: `avm install latest && avm use latest`
- Node ≥ 18 for tests and oracle

### Build

```bash
cd Contract
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build
```

Outputs `target/idl/hivework.json` (consumed by every other service) and `target/deploy/hivework.so`.

### Deploy to devnet

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

If the program ID changes, run `anchor keys sync` and update:

- `Anchor.toml`
- `COORDINATION.md`
- `web/.env.local` → `NEXT_PUBLIC_PROGRAM_ID`
- `indexer/.env` → `HIVEWORK_PROGRAM_ID`
- `mcp/.env` → `HIVEWORK_PROGRAM_ID`

### Test

```bash
cd Contract
npm install                                  # first time
anchor test --provider.cluster devnet
```

Runs `tests/hivework.ts` end-to-end: campaign creation, multi-level node + leaf creation, conversion registration with oracle, close-and-distribute math, stake forfeit, payout claims, redistribution. Asserts USDC and SOL balance deltas at every step.

### USDC on devnet

The demo needs a USDC mint on devnet. Two options:

- **Custom test mint (recommended for hackathon):** `spl-token create-token --decimals 6` then `spl-token mint <MINT> 10000` to the brand wallet before the demo.
- **Circle's devnet USDC:** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` — requires tokens via Circle's faucet.

---

## See also

- **System architecture, math, and pitch:** [`../README.md`](../README.md)
- **Reference HTTP oracle service:** [`./oracle/README.md`](./oracle/README.md)
- **Indexer that decodes our events + signs conversions:** [`../indexer/README.md`](../indexer/README.md)
- **MCP server that wraps our instructions for AI agents:** [`../mcp/README.md`](../mcp/README.md)
- **Full integration walkthrough for B and C:** [`./INTEGRATION.md`](./INTEGRATION.md)