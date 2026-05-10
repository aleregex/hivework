import { createServer } from 'node:http'
import type { Config } from '../config.js'

export async function startHealthServer(cfg: Config, signal: AbortSignal): Promise<void> {
  const srv = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  srv.listen(cfg.healthzPort, () => {
    console.log('[health] listening on', cfg.healthzPort)
  })
  signal.addEventListener('abort', () => srv.close(), { once: true })
}
