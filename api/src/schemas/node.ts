import { z } from "zod";
import type { NodeMetadata } from "../generated/prisma/client.js";
import {
  DraftStatusSchema,
  NodeLevelSchema,
  PubkeySchema,
} from "./shared.js";

export const NodeSchema = z.object({
  id: z.string(),
  onchainPda: z.string().nullable(),
  campaignId: z.string(),
  level: NodeLevelSchema,
  parentNodeId: z.string().nullable(),
  creatorWallet: z.string(),
  title: z.string(),
  description: z.string(),
  examples: z.unknown().nullable(),
  tags: z.array(z.string()),
  mediaUrls: z.array(z.string()),
  stakeSol: z.string(),
  forkCount: z.number().int(),
  conversionsCount: z.number().int(),
  status: DraftStatusSchema,
  createdAt: z.string(),
});

export const CreateNodeDraftBody = z.object({
  campaignId: z.string().min(1),
  level: NodeLevelSchema,
  parentNodeId: z.string().nullable().optional(),
  creatorWallet: PubkeySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2_000),
  examples: z.unknown().optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  stakeSol: z.coerce.number().nonnegative().max(1_000),
});

export const FinalizeNodeBody = z.object({
  draftId: z.string().min(1),
  onchainPda: PubkeySchema,
});

export function mapNode(n: NodeMetadata): z.infer<typeof NodeSchema> {
  return {
    id: n.id,
    onchainPda: n.onchainPda,
    campaignId: n.campaignId,
    level: n.level,
    parentNodeId: n.parentNodeId,
    creatorWallet: n.creatorWallet,
    title: n.title,
    description: n.description,
    examples: (n.examples as unknown) ?? null,
    tags: n.tags,
    mediaUrls: n.mediaUrls,
    stakeSol: n.stakeSol.toString(),
    forkCount: n.forkCount,
    conversionsCount: n.conversionsCount,
    status: n.status,
    createdAt: n.createdAt.toISOString(),
  };
}
