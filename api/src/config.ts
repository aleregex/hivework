import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3401),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Oracle webhook URL. /demo/convert POSTs each new pending_conversion here so
  // the oracle can sign + push register_conversion on-chain. Optional: when
  // unset the conversion stays in 'pending' until something else picks it up.
  ORACLE_WEBHOOK_URL: z.string().url().optional(),
  // Bearer token sent to the oracle webhook. Set the matching token in the
  // oracle's env so it can authenticate inbound webhook calls.
  ORACLE_WEBHOOK_TOKEN: z.string().min(1).optional(),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
