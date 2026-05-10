type Level = 'info' | 'warn' | 'error'

function emit(tag: string, level: Level, msg: string, extra?: unknown) {
  const line = `[${tag}] ${msg}`
  if (extra === undefined) console[level](line)
  else console[level](line, extra)
}

function tag(name: string) {
  return {
    info: (msg: string, extra?: unknown) => emit(name, 'info', msg, extra),
    warn: (msg: string, extra?: unknown) => emit(name, 'warn', msg, extra),
    error: (msg: string, extra?: unknown) => emit(name, 'error', msg, extra),
  }
}

export const log = {
  indexer: tag('indexer'),
  oracle: tag('oracle'),
  backfill: tag('backfill'),
  health: tag('health'),
}
