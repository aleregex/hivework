import 'dotenv/config'

export type Config = {
  rpcHttp: string
  rpcWs: string
  programId: string
  oracleKeypairPath: string
  databaseUrl: string
  healthzPort: number
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export function loadConfig(): Config {
  return {
    rpcHttp: required('RPC_HTTP'),
    rpcWs: required('RPC_WS'),
    programId: required('PROGRAM_ID'),
    oracleKeypairPath: process.env.ORACLE_KEYPAIR_PATH ?? './oracle.json',
    databaseUrl: required('DATABASE_URL'),
    healthzPort: Number(process.env.HEALTHZ_PORT ?? 3403),
  }
}
