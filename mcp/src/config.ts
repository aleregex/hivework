import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  MCP_PORT: z.coerce.number().int().positive().default(3402),
  B1_API_URL: z.string().url().default("http://localhost:3401"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  HIVEWORK_PROGRAM_ID: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;

export const isProgramReady = (): boolean =>
  Boolean(config.HIVEWORK_PROGRAM_ID);
