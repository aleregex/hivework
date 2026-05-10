import { loadConfig } from './config.js'
import { startListener } from './listener/index.js'
import { startBackfill } from './backfill/loop.js'
import { startOraclePoller } from './oracle/poller.js'
import { startHealthServer } from './health/server.js'

const cfg = loadConfig()
const ctrl = new AbortController()

process.on('SIGINT', () => ctrl.abort())
process.on('SIGTERM', () => ctrl.abort())

await Promise.all([
  startHealthServer(cfg, ctrl.signal),
  startListener(cfg, ctrl.signal),
  startBackfill(cfg, ctrl.signal),
  startOraclePoller(cfg, ctrl.signal),
])
