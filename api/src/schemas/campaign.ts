import { z } from "zod";
import type { CampaignMetadata } from "../generated/prisma/client.js";
import {
  CampaignStatusSchema,
  PubkeySchema,
} from "./shared.js";

export const CampaignStatsSchema = z.object({
  nodeCount: z.number().int(),
  leafCount: z.number().int(),
  clickCount: z.number().int(),
  conversionsCount: z.number().int(),
});

export const CampaignSummarySchema = z.object({
  id: z.string(),
  onchainPda: z.string().nullable(),
  status: CampaignStatusSchema,
  brand: z.object({
    name: z.string(),
    logoUrl: z.string().nullable(),
  }),
  product: z.object({
    name: z.string(),
    imageUrl: z.string().nullable(),
    description: z.string(),
  }),
  redirectUrl: z.string(),
  creatorWallet: z.string(),
  poolUsdc: z.string(),
  createdAt: z.string(),
  stats: CampaignStatsSchema,
});

export const CreateCampaignDraftBody = z.object({
  brandName: z.string().min(1).max(120),
  brandLogoUrl: z.string().url().optional().nullable(),
  productName: z.string().min(1).max(200),
  productImageUrl: z.string().url().optional().nullable(),
  productDescription: z.string().min(1).max(2_000),
  redirectUrl: z.string().url(),
  creatorWallet: PubkeySchema,
  poolUsdc: z.coerce.number().nonnegative().max(10_000_000),
});

export const FinalizeCampaignBody = z.object({
  draftId: z.string().min(1),
  onchainPda: PubkeySchema,
});

export type CampaignSummary = z.infer<typeof CampaignSummarySchema>;

export type CampaignWithCounts = CampaignMetadata & {
  _count: {
    nodes: number;
    leaves: number;
  };
};

export function mapCampaign(
  c: CampaignWithCounts,
  extras: { clickCount: number; conversionsCount: number },
): CampaignSummary {
  return {
    id: c.id,
    onchainPda: c.onchainPda,
    status: c.status,
    brand: {
      name: c.brandName,
      logoUrl: c.brandLogoUrl,
    },
    product: {
      name: c.productName,
      imageUrl: c.productImageUrl,
      description: c.productDescription,
    },
    redirectUrl: c.redirectUrl,
    creatorWallet: c.creatorWallet,
    poolUsdc: c.poolUsdc.toString(),
    createdAt: c.createdAt.toISOString(),
    stats: {
      nodeCount: c._count.nodes,
      leafCount: c._count.leaves,
      clickCount: extras.clickCount,
      conversionsCount: extras.conversionsCount,
    },
  };
}
