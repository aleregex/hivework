// Polls pending_conversions every 10s. For each row: validate → (if ok) sign &
// send a registerConversion tx with the oracle keypair → mark pushed_to_chain.
// Real tx assembly lands when Grupo A ships the IDL via codama codegen.
import type { Config } from '../config.js'
import { prisma } from '../db.js'
import { validate } from './validate.js'
import { loadOracleSigner } from './signer.js'
import { log } from '../log.js'
import { sleep } from '../sleep.js'

const PLACEHOLDER = 'PLACEHOLDER_UNTIL_GROUP_A_DEPLOYS'

export async function startOraclePoller(cfg: Config, signal: AbortSignal): Promise<void> {
  // Eagerly load signer so we fail fast if oracle.json is missing/malformed.
  let oraclePubkey: string | null = null
  try {
    const signer = await loadOracleSigner(cfg)
    oraclePubkey = signer.address.toString()
    log.oracle.info('signer loaded', { pubkey: oraclePubkey })
  } catch (e) {
    log.oracle.error('signer load failed — poller will retry', { err: String(e) })
  }

  while (!signal.aborted) {
    try {
      await tick(cfg, oraclePubkey)
    } catch (e) {
      log.oracle.error('tick failed', { err: String(e) })
    }
    await sleep(10_000, signal)
  }
}

async function tick(cfg: Config, _oraclePubkey: string | null) {
  if (cfg.programId === PLACEHOLDER) {
    // Don't churn through pending rows when we couldn't push them on-chain yet.
    return
  }

  const pending = await prisma.pendingConversion.findMany({
    where: { status: 'pending' },
    take: 25,
    orderBy: { createdAt: 'asc' },
  })
  if (pending.length === 0) return

  for (const row of pending) {
    const v = await validate(row.id)
    if (!v.ok) {
      await prisma.pendingConversion.update({
        where: { id: row.id },
        data: { status: 'rejected' },
      })
      log.oracle.warn('rejected', { id: row.id, reason: v.reason })
      continue
    }

    // TODO(post-IDL): build & send registerConversion ix with oracle signer.
    //   const ix = getRegisterConversionInstruction({
    //     leaf: address(v.leafPda),
    //     oracle: signer,
    //     valueUsdc: row.valueUsdc.toFixed(0),
    //     conversionId: row.id,
    //   })
    //   const sig = await sendAndConfirm(rpc, [ix], signer)
    //   await prisma.pendingConversion.update({
    //     where: { id: row.id },
    //     data: { status: 'pushed_to_chain', pushedTxSig: sig },
    //   })
    //
    // For now: bump to 'verified' so api/ can reflect that the oracle accepted
    // it, but leave the on-chain push for after IDL ships.
    await prisma.pendingConversion.update({
      where: { id: row.id },
      data: { status: 'verified' },
    })
    log.oracle.info('verified (awaiting on-chain push)', { id: row.id, leafPda: v.leafPda })
  }
}
