import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  MCP_URL: z.string().url().default("http://localhost:4000/mcp"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;