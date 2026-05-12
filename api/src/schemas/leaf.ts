import { z } from "zod";
import type { LeafMetadata } from "../generated/prisma/client.js";
import { REF_CODE_REGEX } from "../refcode.js";
import {
  DraftStatusSchema,
  PlatformSchema,
  PubkeySchema,
} from "./shared.js";

export const LeafSchema = z.object({
  id: z.string(),
  onchainPda: z.string().nullable(),
  campaignId: z.string(),
  path: z.array(z.string()),
  creatorWallet: z.string(),
  refCode: z.string(),
  contentUrl: z.string().nullable(),
  platform: PlatformSchema,
  stakeSol: z.string(),
  clicksCount: z.number().int(),
  conversionsCount: z.number().int(),
  status: DraftStatusSchema,
  createdAt: z.string(),
});

export const CreateLeafDraftBody = z.object({
  campaignId: z.string().min(1),
  // [L1, L2, L3] node ids — order matters
  path: z.array(z.string().min(1)).length(3),
  creatorWallet: PubkeySchema,
  contentUrl: z.string().url().optional().nullable(),
  platform: PlatformSchema,
  stakeSol: z.coerce.number().nonnegative().max(1_000),
});

export const CreateLeafDraftResponse = z.object({
  leaf: LeafSchema,
  reservation: z.object({
    refCode: z.string().regex(REF_CODE_REGEX),
    expiresAt: z.string(),
  }),
});

export const FinalizeLeafBody = z.object({
  draftId: z.string().min(1),
  refCode: z.string().regex(REF_CODE_REGEX),
  onchainPda: PubkeySchema,
});

export function mapLeaf(
  l: LeafMetadata,
  extras: { clicksCount: number; conversionsCount: number } = {
    clicksCount: 0,
    conversionsCount: 0,
  },
): z.infer<typeof LeafSchema> {
  return {
    id: l.id,
    onchainPda: l.onchainPda,
    campaignId: l.campaignId,
    path: l.path,
    creatorWallet: l.creatorWallet,
    refCode: l.refCode,
    contentUrl: l.contentUrl,
    platform: l.platform,
    stakeSol: l.stakeSol.toString(),
    clicksCount: extras.clicksCount,
    conversionsCount: extras.conversionsCount,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  };
}
