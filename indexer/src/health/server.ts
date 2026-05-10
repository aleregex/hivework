import { createServer } from 'node:http'
import { address } from '@solana/kit'
import { createRpcClients } from '../rpc.js'
import { prisma } from '../db.js'
import { slotCursor } from '../slot-cursor.js'
import { listenerStatus } from '../status.js'
import { loadOracleSigner } from '../oracle/signer.js'
import { log } from '../log.js'
import type { Config } from '../config.js'

const LAMPORTS_PER_SOL = 1_000_000_000n

export async function startHealthServer(cfg: Config, signal: AbortSignal): Promise<void> {
  // Cache signer load so /healthz doesn't re-read oracle.json on every hit.
  let oraclePubkey: string | null = null
  try {
    const signer = await loadOracleSigner(cfg)
    oraclePubkey = signer.address.toString()
  } catch (e) {
    log.health.warn('oracle signer not available for /healthz', { err: String(e) })
  }

  const { rpc } = createRpcClients(cfg)

  const srv = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      const payload = await collect(rpc, oraclePubkey)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(payload))
      return
    }
    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((resolve) => {
    srv.once('error', (e) => {
      log.health.error('listen failed — health endpoint disabled', {
        port: cfg.healthzPort,
        err: String(e),
      })
      resolve()  // swallow; the indexer keeps running without /healthz
    })
    srv.listen(cfg.healthzPort, () => {
      log.health.info('listening', { port: cfg.healthzPort })
      resolve()
    })
  })
  signal.addEventListener('abort', () => srv.close(), { once: true })
}

async function collect(
  rpc: ReturnType<typeof createRpcClients>['rpc'],
  oraclePubkey: string | null,
) {
  const [pendingCount, oracleBalanceSol] = await Promise.all([
    prisma.pendingConversion.count({ where: { status: 'pending' } }).catch(() => -1),
    oracleBalance(rpc, oraclePubkey),
  ])

  return {
    ok: true,
    ts: new Date().toISOString(),
    ws_connected: listenerStatus.connected,
    last_slot: slotCursor.get().toString(),
    pending_conversions_count: pendingCount,
    oracle_pubkey: oraclePubkey,
    oracle_balance_sol: oracleBalanceSol,
  }
}

async function oracleBalance(
  rpc: ReturnType<typeof createRpcClients>['rpc'],
  oraclePubkey: string | null,
): Promise<string | null> {
  if (!oraclePubkey) return null
  try {
    const { value } = await rpc.getBalance(address(oraclePubkey)).send()
    const lamports = BigInt(value)
    const whole = lamports / LAMPORTS_PER_SOL
    const frac = lamports % LAMPORTS_PER_SOL
    return `${whole}.${frac.toString().padStart(9, '0')}`
  } catch {
    return null
  }
}
