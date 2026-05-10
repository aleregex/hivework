// One handler per event. All upserts are idempotent so the backfill loop
// can re-run them safely. Handlers MUST NOT throw — a crash here kills the
// listener and the demo. Catch + log + continue.
import { prisma } from '../db.js'
import { log } from '../log.js'
import type { AnchorEvent } from '../events.js'

export async function dispatch(
  event: AnchorEvent,
  signature: string,
  slot: bigint,
): Promise<void> {
  try {
    switch (event.name) {
      case 'CampaignCreated':
        return await onCampaignCreated(event, signature, slot)
      case 'NodeCreated':
        return await onNodeCreated(event, signature, slot)
      case 'LeafCreated':
        return await onLeafCreated(event, signature, slot)
      case 'ConversionRegistered':
        return await onConversionRegistered(event, signature, slot)
      case 'CampaignClosed':
        return await onCampaignClosed(event, signature, slot)
    }
  } catch (e) {
    log.indexer.error('handler failed', {
      event: event.name,
      sig: signature,
      slot: slot.toString(),
      err: String(e),
    })
  }
}

async function onCampaignCreated(
  ev: Extract<AnchorEvent, { name: 'CampaignCreated' }>,
  sig: string,
  slot: bigint,
) {
  const res = await prisma.campaignMetadata.update({
    where: { id: ev.metadataCuid },
    data: { onchainPda: ev.campaignPda, status: 'active' },
  }).catch(() => null)

  if (!res) {
    // Draft missing or already linked under a different cuid — backfill will reconcile.
    log.indexer.warn('CampaignCreated: cuid not found, backfill will retry', {
      cuid: ev.metadataCuid,
      pda: ev.campaignPda,
      sig,
      slot: slot.toString(),
    })
    return
  }
  log.indexer.info('campaign activated', { cuid: ev.metadataCuid, pda: ev.campaignPda })
}

async function onNodeCreated(
  ev: Extract<AnchorEvent, { name: 'NodeCreated' }>,
  sig: string,
  slot: bigint,
) {
  const res = await prisma.nodeMetadata.update({
    where: { id: ev.metadataCuid },
    data: {
      onchainPda: ev.nodePda,
      status: 'finalized',
      stakeSol: lamportsToSol(ev.stakeLamports),
    },
  }).catch(() => null)

  if (!res) {
    log.indexer.warn('NodeCreated: cuid not found', {
      cuid: ev.metadataCuid, pda: ev.nodePda, sig, slot: slot.toString(),
    })
    return
  }

  // Bump parent fork_count if there's a parent.
  if (ev.parentNodePda) {
    await prisma.nodeMetadata.updateMany({
      where: { onchainPda: ev.parentNodePda },
      data: { forkCount: { increment: 1 } },
    }).catch((e) => log.indexer.warn('parent forkCount bump failed', { err: String(e) }))
  }
  log.indexer.info('node finalized', { cuid: ev.metadataCuid, level: ev.level })
}

async function onLeafCreated(
  ev: Extract<AnchorEvent, { name: 'LeafCreated' }>,
  sig: string,
  slot: bigint,
) {
  const res = await prisma.leafMetadata.update({
    where: { id: ev.metadataCuid },
    data: {
      onchainPda: ev.leafPda,
      status: 'finalized',
      stakeSol: lamportsToSol(ev.stakeLamports),
      // refCode is reserved at draft time; the on-chain ref_code MUST match.
      // We do not overwrite it here — divergence is a coordination bug.
    },
  }).catch(() => null)

  if (!res) {
    log.indexer.warn('LeafCreated: cuid not found', {
      cuid: ev.metadataCuid, pda: ev.leafPda, sig, slot: slot.toString(),
    })
    return
  }
  log.indexer.info('leaf finalized', { cuid: ev.metadataCuid, refCode: ev.refCode })
}

async function onConversionRegistered(
  ev: Extract<AnchorEvent, { name: 'ConversionRegistered' }>,
  sig: string,
  slot: bigint,
) {
  // The pending row was inserted by api/'s /demo/convert. The oracle pushed it
  // on-chain. Now we mark it pushed and bump the leaf + ancestor counters.
  const updated = await prisma.pendingConversion.updateMany({
    where: { pushedTxSig: sig },
    data: { status: 'pushed_to_chain' },
  })

  // Bump leaf conversion count by looking up by PDA.
  const leaf = await prisma.leafMetadata.findUnique({
    where: { onchainPda: ev.leafPda },
    select: { id: true, path: true },
  })
  if (!leaf) {
    log.indexer.warn('ConversionRegistered: leaf PDA not indexed yet', {
      pda: ev.leafPda, sig, slot: slot.toString(),
    })
    return
  }
  await prisma.nodeMetadata.updateMany({
    where: { onchainPda: { in: leaf.path } },
    data: { conversionsCount: { increment: 1 } },
  }).catch((e) => log.indexer.warn('ancestor counter bump failed', { err: String(e) }))

  log.indexer.info('conversion pushed_to_chain', {
    leafPda: ev.leafPda,
    pendingMatched: updated.count,
  })
}

async function onCampaignClosed(
  ev: Extract<AnchorEvent, { name: 'CampaignClosed' }>,
  _sig: string,
  _slot: bigint,
) {
  await prisma.campaignMetadata.updateMany({
    where: { onchainPda: ev.campaignPda },
    data: { status: 'closed' },
  }).catch((e) => log.indexer.warn('CampaignClosed update failed', { err: String(e) }))
  log.indexer.info('campaign closed', { pda: ev.campaignPda })
}

function lamportsToSol(l: bigint): string {
  // Decimal column in schema is (18, 9). Convert lamports → SOL string with 9 dp.
  const LAMPORTS_PER_SOL = 1_000_000_000n
  const whole = l / LAMPORTS_PER_SOL
  const frac = l % LAMPORTS_PER_SOL
  return `${whole}.${frac.toString().padStart(9, '0')}`
}
