import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  MCP_URL: z.string().url().default("http://localhost:4000/mcp"),
  B1_API_URL: z.string().url().default("http://localhost:3001"),
  RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  PROGRAM_ID: z.string().optional(),
  WALLET_PATH: z.string().default("./agent-wallet.json"),
  ENABLE_ONCHAIN: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
