// MVP anti-fraud fence for the oracle: leaf must exist, be finalized, have a
// ref_code, have ≥1 prior click, and the conversion value must be > 0.
// IP/dedup checks live upstream at api/'s /demo/convert (it's the row creator).
import { prisma } from '../db.js'

export type ValidationResult =
  | { ok: true; leafPda: string }
  | { ok: false; reason: string }

export async function validate(pendingId: string): Promise<ValidationResult> {
  const pc = await prisma.pendingConversion.findUnique({
    where: { id: pendingId },
    include: {
      leaf: { include: { _count: { select: { clicks: true } } } },
    },
  })
  if (!pc) return { ok: false, reason: 'pending_not_found' }
  if (pc.status !== 'pending') return { ok: false, reason: `status_${pc.status}` }
  if (pc.valueUsdc.lte(0)) return { ok: false, reason: 'non_positive_value' }
  if (!pc.leaf.refCode) return { ok: false, reason: 'leaf_missing_refcode' }
  if (pc.leaf.status !== 'finalized') return { ok: false, reason: 'leaf_not_finalized' }
  if (!pc.leaf.onchainPda) return { ok: false, reason: 'leaf_not_onchain' }
  if (pc.leaf._count.clicks < 1) return { ok: false, reason: 'no_prior_click' }
  return { ok: true, leafPda: pc.leaf.onchainPda }
}
