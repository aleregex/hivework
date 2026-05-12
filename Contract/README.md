# `Contract/` — Hivework Solana Program (Anchor)

> **Group A.** The on-chain core of Hivework. An Anchor program that custodies USDC escrow, locks SOL stakes, attests to conversions through an authorized oracle, and distributes payouts proportionally along the genealogical path that produced each sale.

[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF?logo=solana&logoColor=white)](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet)
[![Anchor](https://img.shields.io/badge/anchor-1.0-blue)](https://www.anchor-lang.com)
[![Rust](https://img.shields.io/badge/rust-edition--2021-orange?logo=rust)](https://www.rust-lang.org)

🔗 **Program (devnet):** [`8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8`](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet)

---

## What this program is

Hivework's on-chain program is the **only place where money moves**. Every other service (`api/`, `indexer/`, `mcp/`, `web/`, `agent/`) is glue around this binary. The program owns four account types and 11 instructions. Its role is narrow and load-bearing:

- **Custody.** Holds the brand's USDC in a campaign-scoped escrow ATA from `create_campaign` until close.
- **Stake locking.** Forces every node and leaf creator to lock SOL at creation, releasing it only if the node (or any descendant) generates ≥ 1 conversion.
- **Attribution.** Stores the genealogical path `[L1, L2, L3]` on every leaf as part of the on-chain account, immutable and auditable.
- **Attestation gate.** Only the campaign's pre-declared `oracle_authority` can call `register_conversion`. No conversion can be forged by participants.
- **Payout math.** Computes the proportional weight of each ancestor and distributes USDC accordingly with a 5% platform fee and a 30% leaf bonus.
- **Anti-spam economics.** Loser stakes are forfeited to a redistribution pool that winners share proportionally — turning spammers into fundraisers for legitimate creators.

---

## How it integrates with the rest of the system

```
   web/ + agent/  ───── sign Anchor txs ────►  Hivework program  ◄──── register_conversion
                                                  │  ▲                       │
                                                  │  │                       │
            emits 5 events ──────────►            │  │ reads accounts        │ signs with
            CampaignCreated, NodeCreated,         │  │ via getAccountInfo    │ oracle keypair
            LeafCreated, ConversionRegistered,    │  │                       │
            CampaignClosed                        ▼  │                       │
                                            Solana devnet                    │
                                              │   ▲                          │
                                              │   │                          │
                                              ▼   │                          │
                              ┌─────────────────────────────────┐            │
                              │           indexer/              │            │
                              │   listener (parses events)      │ ───────────┘
                              │   oracle poller (signs txs)     │
                              └────────────┬────────────────────┘
                                           ▼
                                    Postgres (Neon)
                                           ▲
                                           │
                                       api/  ──── reads tree, writes drafts
                                           ▲
                                           │
                                       web/  +  mcp/
```

**Integration contracts:**

| Counterparty | Reads | Writes |
|---|---|---|
| `web/` (`lib/anchor/`) | All account types via Anchor codegen | `create_campaign`, `create_node`, `create_leaf`, `claim_payout`, `claim_leaf_payout` |
| `agent/` via `mcp/` | `Campaign`, `Node`, `Leaf` | `create_node`, `create_leaf` (signed by agent's own wallet) |
| `indexer/` listener | All program logs (Codama-decoded) | _(read only)_ |
| `indexer/` oracle / `Contract/oracle/` | `Leaf` (path), `Campaign` | `register_conversion` (only signer permitted) |
| Anyone (post-deadline) | `Campaign`, `Node`, `Leaf`, `Conversion` | `close_and_distribute`, `forfeit_*`, `withdraw_unused_usdc`, `claim_redistribution` |

The IDL at `idl/hivework.json` is the **wire contract**. Every other service consumes it: the frontend types its program client from it, the indexer generates its event decoder from it via Codama, the MCP server uses it to build unsigned transactions for agents.

---

## Project layout

```
Contract/
├── programs/hivework/src/
│   ├── lib.rs           # 11 instructions + contexts + payout math (~930 LOC)
│   ├── state.rs         # 4 account types: Campaign, Node, Leaf, Conversion
│   ├── constants.rs     # Stakes, fees, default α/β/γ, position factors, PDA seeds
│   ├── errors.rs        # 16 typed errors (codes 6000+)
│   └── events.rs        # 5 events emitted on every state transition
├── tests/
│   └── hivework.ts      # End-to-end happy-path test suite (Mocha + Anchor)
├── oracle/              # Reference HTTP oracle service (see oracle/README.md)
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

Four PDA account types. All seeds are derivable off-chain so clients can compute addresses without RPC calls.

| Account | Seeds | Notes |
|---|---|---|
| `Campaign` | `["campaign", authority, campaign_id_u32_le]` | Holds escrow ATA, weights `α/β/γ`, deadline, oracle pubkey, conversions counter, `usdc_mint` |
| `Node` | `["node", campaign, creator, metadata_hash_32]` | Level 1 / 2 / 3, parent reference, stake locked, fork count, conversions count |
| `Leaf` | `["leaf", campaign, ref_code_8_ascii]` | Genealogical path `[Pubkey; 3]`, ref_code as PDA seed |
| `Conversion` | `["conversion", campaign, leaf, conversion_id_16]` | Value, processed flag, oracle-signed |

`metadata_hash` on `Node` is **SHA-256 of the canonical JSON** stored in `api/`'s Postgres. The hash is signed on-chain — the actual metadata is off-chain but tamper-evident.

---

## Instructions

| # | Instruction | Caller | Purpose |
|---|---|---|---|
| 1 | `create_campaign` | Brand | Initializes Campaign PDA + escrow ATA, accepts initial USDC, sets weights + deadline + oracle |
| 2 | `create_node` | Anyone | Creates an L1/L2/L3 node, locks the level-appropriate stake, validates parent chain |
| 3 | `create_leaf` | Anyone | Publishes a leaf, validates the `[L1, L2, L3]` path against on-chain nodes, locks 0.1 SOL |
| 4 | `register_conversion` | **Oracle only** | Records a verified sale. `oracle: Signer` constraint enforces that only the campaign's pre-declared oracle pubkey can call this |
| 5 | `close_and_distribute` | Anyone (post-deadline) | Processes one conversion per call: computes weights, transfers USDC to ancestors and leaf creator |
| 6 | `forfeit_node_stake` | Anyone (post-close) | Loser nodes (`conversions_count == 0`) forfeit stake to the redistribution pool |
| 7 | `forfeit_leaf_stake` | Anyone (post-close) | Same for leaves |
| 8 | `claim_payout` | Node creator | Withdraws accumulated USDC + releases stake if winner |
| 9 | `claim_leaf_payout` | Leaf creator | Same for leaves, with the +30% leaf bonus already accumulated |
| 10 | `withdraw_unused_usdc` | Brand | After all conversions processed, brand reclaims any leftover escrow |
| 11 | `claim_redistribution` | Winning leaf creator | Proportional share of the forfeited-stake pool |

### `create_campaign` signature (v0.2 — USDC + oracle authority)

```ts
program.methods
  .createCampaign(deadline, alpha, beta, gamma, campaignId, initialUsdc)
  .accounts({
    campaign: campaignPda,
    usdcMint,
    escrowUsdc,             // ATA derived from campaignPda + usdcMint
    authorityUsdc,          // brand's USDC ATA (source of escrow funds)
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
- `initial_usdc > 0`

### `claim_payout` / `claim_leaf_payout` signature

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

All values live in `programs/hivework/src/constants.rs`. They are reproduced from the protocol spec verbatim — see [the root README](../README.md#the-math-proportional-payout-formula) for the full derivation.

### Stakes (lamports)

| Level | Stake | Rationale |
|---|---|---|
| L1 (hook) | 1.0 SOL | Hardest to do well, highest reward potential |
| L2 (audio) | 0.5 SOL | |
| L3 (visual) | 0.25 SOL | |
| Leaf | 0.1 SOL | Lowest, but earns +30% bonus on each conversion |

### Fees & bonuses

| Constant | Value |
|---|---|
| `PLATFORM_FEE_PERCENTAGE` | 5% |
| `LEAF_BONUS_PERCENTAGE` | 30% |

### Default payout weights

The brand can override these per campaign at `create_campaign` (must sum to 100).

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

### The on-chain payout formula (literal from spec)

```
weight(node) = α × ln(descendant_forks + 1)
             + β × min(bytes_metadata / 1000, 1.0)
             + γ × position_factor[level]
```

`ln(x)` is approximated as `ilog2(x) × ln(2)` with integer scaling — Solana doesn't allow floats. The approximation is monotonic and sufficient for a relative weighting.

### Distribution per conversion

1. Subtract 5% platform fee.
2. Reserve 30% of the remainder as the leaf bonus.
3. The remaining 65% is split between L1, L2, L3, and the leaf according to weights.
4. The leaf creator receives `leaf_weight_share + 30% bonus`.

### Stake redistribution (positive-sum anti-spam)

After campaign close:

- Anyone may call `forfeit_node_stake` / `forfeit_leaf_stake` on accounts with `conversions_count == 0` and `stake_locked > 0`. Stake moves to `Campaign.forfeited_pool`.
- Each winning leaf may call `claim_redistribution` once to withdraw `pool × leaf.conversions_count / campaign.total_conversions` lamports.
- **Design choice:** only leaves participate in redistribution (not nodes), because every conversion increments exactly one leaf — giving a clean proportionality. Winning nodes already recover their full stake on `claim_payout`.

---

## Events

Each event below is emitted on the Solana log stream and decoded by `indexer/` via Codama bindings.

| Event | Fields |
|---|---|
| `CampaignCreated` | `campaign`, `authority`, `total_usdc`, `deadline` |
| `NodeCreated` | `node`, `campaign`, `creator`, `level` |
| `LeafCreated` | `leaf`, `campaign`, `creator`, `ref_code` |
| `ConversionRegistered` | `conversion`, `campaign`, `leaf`, `value` |
| `CampaignClosed` | `campaign`, `conversions_processed` |

---

## Errors

16 typed errors with codes 6000–6015. Surface them in the frontend as user-facing messages.

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
| 6009 | `ConversionAlreadyRegistered` | This conversion was already distributed |
| 6010 | `DataTooLarge` | Metadata exceeds maximum length |
| 6011 | `InvalidWeights` | α + β + γ ≠ 100 |
| 6012 | `InvalidDeadline` | Deadline is in the past |
| 6013 | `NodeIsWinner` | Only nodes with zero conversions can be forfeited |
| 6014 | `NoStakeToForfeit` | No stake remains to forfeit |
| 6015 | `RedistributionAlreadyClaimed` | Leaf already claimed its pool share |

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

Outputs `target/idl/hivework.json` (consumed by all other services) and `target/deploy/hivework.so`.

### Deploy to devnet

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

The program ID is printed on success. If it changes, run `anchor keys sync` and update:

- `Anchor.toml`
- `COORDINATION.md`
- `web/.env.local` → `NEXT_PUBLIC_PROGRAM_ID`
- `indexer/.env` → `HIVEWORK_PROGRAM_ID`
- `mcp/.env` → `HIVEWORK_PROGRAM_ID`

### Test

```bash
cd Contract
npm install     # first time
anchor test --provider.cluster devnet
```

Runs `tests/hivework.ts` end-to-end: campaign creation, multi-level node + leaf creation, conversion registration with oracle, close-and-distribute math, stake forfeit, payout claims, redistribution. Asserts USDC and SOL balance changes at every step.

### USDC on devnet

The demo needs a USDC mint on devnet. Two options:

- **Custom test mint** (recommended for hackathon): `spl-token create-token --decimals 6` then `spl-token mint <MINT> 10000` to the brand wallet before the demo.
- **Circle's devnet USDC**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Requires tokens via Circle's faucet.

---

## Security notes & known limitations

| Concern | Status | Notes |
|---|---|---|
| Oracle signature | ⚠️ Pubkey-only check | The current `register_conversion` enforces `oracle: Signer` via Anchor's address constraint, which proves the keypair signed the tx. There is no additional ed25519 verification of an off-chain payload — for the demo this is sufficient because the oracle keypair *is* the trust anchor. For mainnet, consider adding a signed conversion payload + ed25519 sysvar program verification to support gasless conversion submission. |
| Integer math | ✅ saturating + checked | All arithmetic uses `checked_*` / `saturating_*`; truncation in division is acceptable (residual goes to platform fee). |
| Reentrancy | ✅ N/A | Solana's runtime model rules out classic reentrancy. |
| `close_and_distribute` permissioning | ✅ open + safe | Anyone can call it post-deadline; the Campaign PDA is the authority for the escrow ATA, so funds can only flow per the program's logic regardless of caller. |
| Metadata tampering | ✅ on-chain hash | `metadata_hash` is signed on-chain at `create_node` time. `api/` cannot rewrite history; the indexer rejects metadata whose hash doesn't match. |

---

## See also

- **System architecture, math, and pitch:** [`../README.md`](../README.md)
- **Reference HTTP oracle service:** [`./oracle/README.md`](./oracle/README.md)
- **Indexer that decodes our events + signs conversions:** [`../indexer/README.md`](../indexer/README.md)
- **MCP server that wraps our instructions for AI agents:** [`../mcp/README.md`](../mcp/README.md)
- **Full integration walkthrough for B and C:** [`./INTEGRATION.md`](./INTEGRATION.md)
