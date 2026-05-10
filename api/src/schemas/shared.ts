import { z } from "zod";

// Solana pubkey: base58, 32 bytes => 32-44 chars. We don't bs58-decode here;
// regex is enough for the demo and avoids pulling a dep at this layer.
export const PubkeySchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "must be base58");

export const NodeLevelSchema = z.enum(["L1", "L2", "L3"]);
export const PlatformSchema = z.enum([
  "tiktok",
  "instagram",
  "x",
  "youtube",
  "other",
]);
export const CampaignStatusSchema = z.enum(["draft", "active", "closed"]);
export const DraftStatusSchema = z.enum(["draft", "finalized"]);
export const ConversionStatusSchema = z.enum([
  "pending",
  "verified",
  "pushed_to_chain",
  "rejected",
]);

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const PaginatedMetaSchema = z.object({
  limit: z.number().int(),
  offset: z.number().int(),
  total: z.number().int(),
});

export const ErrorBodySchema = z.object({
  error: z.string(),
  message: z.string(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
