import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  MCP_PORT: z.coerce.number().int().positive().default(4000),
  B1_API_URL: z.string().url().default("http://localhost:3001"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;