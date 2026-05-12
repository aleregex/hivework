import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";
import { mapNode, NodeSchema } from "../schemas/node.js";
import { LeafSchema, mapLeaf } from "../schemas/leaf.js";
import { PubkeySchema } from "../schemas/shared.js";

// Formula constants — keep in sync with Contract/programs/hivework/src/constants.rs.
// On-chain stores α/β/γ as integers (×100); we use floats off-chain.
const ALPHA = 0.4;
const BETA = 0.4;
const GAMMA = 0.2;
const PLATFORM_FEE = 0.05;
const LEAF_BONUS = 0.3;
const POS_FACTOR = { L1: 1.0, L2: 0.7, L3: 0.5 } as const;
const POS_FACTOR_LEAF = 0.3;

const PendingBreakdownEntrySchema = z.object({
  contributionId: z.string(),
  kind: z.enum(["node", "leaf"]),
  pendingUsdc: z.string(),
});

const PendingByCampaignSchema = z.object({
  campaignId: z.string(),
  campaignOnchainPda: z.string().nullable(),
  campaignName: z.string(),
  brandName: z.string(),
  contributingNodes: z.number().int(),
  pendingUsdc: z.string(),
  status: z.enum(["active", "claimable"]),
  // Per-contribution breakdown of pendingUsdc. Lets the per-campaign earnings
  // panel show "node X earned $Y" without re-running the formula client-side.
  // Ids matching `kind: "node"` resolve in nodes_metadata; "leaf" in leaves_metadata.
  breakdown: z.array(PendingBreakdownEntrySchema),
});

const ClaimHistoryEntrySchema = z.object({
  campaignId: z.string(),
  campaignName: z.string(),
  amountUsdc: z.string(),
  claimedAt: z.string(),
  txSignature: z.string(),
});

const PortfolioResponseSchema = z.object({
  wallet: z.string(),
  nodes: z.array(NodeSchema),
  leaves: z.array(LeafSchema),
  stakedSol: z.string(),
  pendingPayoutsUsdc: z.string(),
  pendingByCampaign: z.array(PendingByCampaignSchema),
  claimHistory: z.array(ClaimHistoryEntrySchema),
  lifetimeClaimedUsdc: z.string(),
});

const walletsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/wallets/:address/portfolio",
    {
      schema: {
        tags: ["wallets"],
        summary:
          "Everything a wallet has authored, plus pending payouts computed from indexed conversions",
        params: z.object({ address: PubkeySchema }),
        response: { 200: PortfolioResponseSchema },
      },
    },
    async (req) => {
      const { address } = req.params;

      const [nodes, leaves, contributingConversions] = await Promise.all([
        app.prisma.nodeMetadata.findMany({
          where: { creatorWallet: address },
          orderBy: { createdAt: "desc" },
        }),
        app.prisma.leafMetadata.findMany({
          where: { creatorWallet: address },
          orderBy: { createdAt: "desc" },
        }),
        app.prisma.pendingConversion.findMany({
          where: { status: { in: ["pushed_to_chain", "verified"] } },
          include: {
            leaf: {
              include: {
                campaign: {
                  select: {
                    id: true,
                    onchainPda: true,
                    brandName: true,
                    productName: true,
                    status: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      let stakedSol = 0;
      for (const n of nodes) if (n.status === "finalized") stakedSol += Number(n.stakeSol);
      for (const l of leaves) if (l.status === "finalized") stakedSol += Number(l.stakeSol);

      // Bulk-load every node referenced by any indexed conversion's path so we
      // can compute weights without N+1 round-trips.
      const allPathIds = Array.from(
        new Set(contributingConversions.flatMap((c) => c.leaf.path)),
      );
      const pathNodes = allPathIds.length
        ? await app.prisma.nodeMetadata.findMany({
            where: { id: { in: allPathIds } },
            select: {
              id: true,
              level: true,
              forkCount: true,
              creatorWallet: true,
              title: true,
              description: true,
              tags: true,
              mediaUrls: true,
              examples: true,
            },
          })
        : [];
      const pathNodeById = new Map(pathNodes.map((n) => [n.id, n]));

      type ContribKind = "node" | "leaf";
      type PerCampaign = {
        campaignId: string;
        campaignOnchainPda: string | null;
        campaignName: string;
        brandName: string;
        contributingIds: Set<string>;
        pendingUsdc: number;
        status: "active" | "claimable";
        // Sum of credits per individual contribution id within this campaign.
        breakdown: Map<string, { kind: ContribKind; pendingUsdc: number }>;
      };
      const perCampaign = new Map<string, PerCampaign>();

      for (const conv of contributingConversions) {
        const leaf = conv.leaf;
        const pNodes = leaf.path
          .map((id) => pathNodeById.get(id))
          .filter((n): n is NonNullable<typeof n> => Boolean(n));
        if (pNodes.length !== 3) continue;
        if (
          pNodes.some((n) => !(n.level in POS_FACTOR)) ||
          pNodes[0].level !== "L1" ||
          pNodes[1].level !== "L2" ||
          pNodes[2].level !== "L3"
        ) {
          continue;
        }

        const value = Number(conv.valueUsdc);
        const richness = (n: (typeof pNodes)[number]): number => {
          const bytes = JSON.stringify({
            title: n.title,
            description: n.description,
            tags: n.tags,
            mediaUrls: n.mediaUrls,
            examples: n.examples,
          }).length;
          return Math.min(bytes / 1000, 1);
        };
        const leafRichness = Math.min(
          JSON.stringify({ contentUrl: leaf.contentUrl, platform: leaf.platform })
            .length / 1000,
          1,
        );

        const nodeWeights = pNodes.map(
          (n) =>
            ALPHA * Math.log(n.forkCount + 1) +
            BETA * richness(n) +
            GAMMA * POS_FACTOR[n.level as keyof typeof POS_FACTOR],
        );
        // Leaves have no descendants — popularity term is 0.
        const leafWeight = BETA * leafRichness + GAMMA * POS_FACTOR_LEAF;
        const total = nodeWeights.reduce((a, b) => a + b, 0) + leafWeight;
        if (total <= 0) continue;

        const distributable = value * (1 - PLATFORM_FEE);

        const contribCredits: { id: string; kind: ContribKind; credit: number }[] = [];
        for (let i = 0; i < pNodes.length; i++) {
          if (pNodes[i].creatorWallet === address) {
            const credit = (nodeWeights[i] / total) * distributable;
            contribCredits.push({ id: pNodes[i].id, kind: "node", credit });
          }
        }
        if (leaf.creatorWallet === address) {
          const leafBase = (leafWeight / total) * distributable;
          contribCredits.push({
            id: leaf.id,
            kind: "leaf",
            credit: leafBase * (1 + LEAF_BONUS),
          });
        }
        const walletCredit = contribCredits.reduce((s, c) => s + c.credit, 0);
        if (walletCredit <= 0) continue;

        const cId = leaf.campaign.id;
        let entry = perCampaign.get(cId);
        if (!entry) {
          entry = {
            campaignId: cId,
            campaignOnchainPda: leaf.campaign.onchainPda,
            campaignName: leaf.campaign.productName,
            brandName: leaf.campaign.brandName,
            contributingIds: new Set<string>(),
            pendingUsdc: 0,
            status: leaf.campaign.status === "closed" ? "claimable" : "active",
            breakdown: new Map(),
          };
          perCampaign.set(cId, entry);
        }
        entry.pendingUsdc += walletCredit;
        for (const c of contribCredits) {
          entry.contributingIds.add(c.id);
          const prev = entry.breakdown.get(c.id);
          entry.breakdown.set(c.id, {
            kind: c.kind,
            pendingUsdc: (prev?.pendingUsdc ?? 0) + c.credit,
          });
        }
      }

      const pendingByCampaign = Array.from(perCampaign.values()).map((c) => ({
        campaignId: c.campaignId,
        campaignOnchainPda: c.campaignOnchainPda,
        campaignName: c.campaignName,
        brandName: c.brandName,
        contributingNodes: c.contributingIds.size,
        pendingUsdc: c.pendingUsdc.toFixed(6),
        status: c.status,
        breakdown: Array.from(c.breakdown.entries()).map(([id, row]) => ({
          contributionId: id,
          kind: row.kind,
          pendingUsdc: row.pendingUsdc.toFixed(6),
        })),
      }));
      const pendingTotal = Array.from(perCampaign.values())
        .reduce((sum, c) => sum + c.pendingUsdc, 0)
        .toFixed(6);

      // PayoutClaim rows are inserted by the indexer when it observes
      // PayoutClaimed events on-chain. They are the source of truth for
      // claim history; the api never inserts here directly.
      const claimRows = await app.prisma.payoutClaim.findMany({
        where: { creatorWallet: address },
        orderBy: { claimedAt: "desc" },
        include: {
          campaign: { select: { id: true, productName: true } },
        },
      });
      const claimHistory = claimRows.map((c) => ({
        campaignId: c.campaign.id,
        campaignName: c.campaign.productName,
        amountUsdc: c.amountUsdc.toString(),
        claimedAt: c.claimedAt.toISOString(),
        txSignature: c.txSignature,
      }));
      const lifetimeClaimedUsdc = claimRows
        .reduce((sum, c) => sum + Number(c.amountUsdc), 0)
        .toFixed(6);

      return {
        wallet: address,
        nodes: nodes.map(mapNode),
        leaves: leaves.map((l) => mapLeaf(l)),
        stakedSol: stakedSol.toFixed(9),
        pendingPayoutsUsdc: pendingTotal,
        pendingByCampaign,
        claimHistory,
        lifetimeClaimedUsdc,
      };
    },
  );
};

export default walletsRoutes;