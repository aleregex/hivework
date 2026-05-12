import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";
import {
  CampaignSummarySchema,
  CreateCampaignDraftBody,
  FinalizeCampaignBody,
  mapCampaign,
  type CampaignWithCounts,
} from "../schemas/campaign.js";
import { mapNode, NodeSchema } from "../schemas/node.js";
import { LeafSchema, mapLeaf } from "../schemas/leaf.js";
import {
  ErrorBodySchema,
  PaginatedMetaSchema,
  PaginationQuerySchema,
} from "../schemas/shared.js";

const campaignsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/campaigns/active",
    {
      schema: {
        tags: ["campaigns"],
        summary: "List active campaigns (paginated)",
        querystring: PaginationQuerySchema,
        response: {
          200: z.object({
            items: z.array(CampaignSummarySchema),
            meta: PaginatedMetaSchema,
          }),
        },
      },
    },
    async (req) => {
      const { limit, offset } = req.query;

      const [rows, total] = await Promise.all([
        app.prisma.campaignMetadata.findMany({
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          include: { _count: { select: { nodes: true, leaves: true } } },
        }),
        app.prisma.campaignMetadata.count({ where: { status: "active" } }),
      ]);

      const ids = rows.map((c) => c.id);
      const counts = ids.length
        ? await getCampaignActivityCounts(app.prisma, ids)
        : new Map<string, { clickCount: number; conversionsCount: number }>();

      return {
        items: rows.map((c) =>
          mapCampaign(
            c as unknown as CampaignWithCounts,
            counts.get(c.id) ?? { clickCount: 0, conversionsCount: 0 },
          ),
        ),
        meta: { limit, offset, total },
      };
    },
  );

  r.get(
    "/campaigns/:id",
    {
      schema: {
        tags: ["campaigns"],
        summary: "Campaign with embedded tree (nodes + leaves)",
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: z.object({
            campaign: CampaignSummarySchema,
            nodes: z.array(NodeSchema),
            leaves: z.array(LeafSchema),
          }),
          404: ErrorBodySchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;

      const campaign = await app.prisma.campaignMetadata.findUnique({
        where: { id },
        include: { _count: { select: { nodes: true, leaves: true } } },
      });
      if (!campaign) {
        return reply.code(404).send({
          error: "campaign_not_found",
          message: `No campaign with id ${id}`,
        });
      }

      const [nodes, leaves, counts, leafConversions] = await Promise.all([
        app.prisma.nodeMetadata.findMany({
          where: { campaignId: id },
          orderBy: [{ level: "asc" }, { createdAt: "asc" }],
        }),
        app.prisma.leafMetadata.findMany({
          where: { campaignId: id },
          orderBy: { createdAt: "asc" },
        }),
        getCampaignActivityCounts(app.prisma, [id]),
        app.prisma.pendingConversion.groupBy({
          by: ["leafId"],
          where: {
            leaf: { campaignId: id },
            status: { in: ["pushed_to_chain", "verified"] },
          },
          _count: { _all: true },
        }) as unknown as Promise<
          { leafId: string; _count: { _all: number } }[]
        >,
      ]);
      const leafConversionsById = new Map(
        leafConversions.map((r) => [r.leafId, r._count._all]),
      );

      return {
        campaign: mapCampaign(
          campaign as unknown as CampaignWithCounts,
          counts.get(id) ?? { clickCount: 0, conversionsCount: 0 },
        ),
        nodes: nodes.map(mapNode),
        leaves: leaves.map((l) =>
          mapLeaf(l, {
            conversionsCount: leafConversionsById.get(l.id) ?? 0,
          }),
        ),
      };
    },
  );

  r.get(
    "/campaigns/:id/conversions",
    {
      schema: {
        tags: ["campaigns"],
        summary:
          "List conversions for a campaign ready for close_and_distribute (with full PDA path)",
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: z.object({
            campaignOnchainPda: z.string().nullable(),
            conversions: z.array(
              z.object({
                pendingConversionId: z.string(),
                conversionIdSeed: z.string(),
                leafPda: z.string(),
                nodeL1Pda: z.string(),
                nodeL2Pda: z.string(),
                nodeL3Pda: z.string(),
                valueUsdc: z.string(),
                status: z.enum(["pushed_to_chain", "verified"]),
                pushedTxSig: z.string().nullable(),
              }),
            ),
          }),
          404: ErrorBodySchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const campaign = await app.prisma.campaignMetadata.findUnique({
        where: { id },
        select: { id: true, onchainPda: true },
      });
      if (!campaign) {
        return reply.code(404).send({
          error: "campaign_not_found",
          message: `No campaign ${id}`,
        });
      }

      const rows = await app.prisma.pendingConversion.findMany({
        where: {
          status: { in: ["pushed_to_chain", "verified"] },
          leaf: { campaignId: id },
        },
        include: {
          leaf: {
            select: { id: true, onchainPda: true, path: true },
          },
        },
      });

      const allPathIds = Array.from(
        new Set(rows.flatMap((r) => r.leaf.path)),
      );
      const pathNodes = allPathIds.length
        ? await app.prisma.nodeMetadata.findMany({
            where: { id: { in: allPathIds } },
            select: { id: true, onchainPda: true },
          })
        : [];
      const pdaByNodeId = new Map(pathNodes.map((n) => [n.id, n.onchainPda]));

      const conversions: Array<{
        pendingConversionId: string;
        conversionIdSeed: string;
        leafPda: string;
        nodeL1Pda: string;
        nodeL2Pda: string;
        nodeL3Pda: string;
        valueUsdc: string;
        status: "pushed_to_chain" | "verified";
        pushedTxSig: string | null;
      }> = [];
      for (const row of rows) {
        const leafPda = row.leaf.onchainPda;
        const l1 = pdaByNodeId.get(row.leaf.path[0]);
        const l2 = pdaByNodeId.get(row.leaf.path[1]);
        const l3 = pdaByNodeId.get(row.leaf.path[2]);
        if (!leafPda || !l1 || !l2 || !l3) continue;
        conversions.push({
          pendingConversionId: row.id,
          // Matches the 16-char seed used by /demo/convert when calling the
          // oracle. Lets the FE re-derive the on-chain Conversion PDA.
          conversionIdSeed: row.id.slice(0, 16),
          leafPda,
          nodeL1Pda: l1,
          nodeL2Pda: l2,
          nodeL3Pda: l3,
          valueUsdc: row.valueUsdc.toString(),
          status: row.status as "pushed_to_chain" | "verified",
          pushedTxSig: row.pushedTxSig,
        });
      }

      return {
        campaignOnchainPda: campaign.onchainPda,
        conversions,
      };
    },
  );

  r.post(
    "/campaigns/draft",
    {
      schema: {
        tags: ["campaigns"],
        summary: "Create campaign draft (off-chain only)",
        body: CreateCampaignDraftBody,
        response: { 201: CampaignSummarySchema },
      },
    },
    async (req, reply) => {
      const body = req.body;
      const created = await app.prisma.campaignMetadata.create({
        data: {
          status: "draft",
          brandName: body.brandName,
          brandLogoUrl: body.brandLogoUrl ?? null,
          productName: body.productName,
          productImageUrl: body.productImageUrl ?? null,
          productDescription: body.productDescription,
          redirectUrl: body.redirectUrl,
          creatorWallet: body.creatorWallet,
          poolUsdc: body.poolUsdc.toString(),
          conversionValueUsdc: body.conversionValueUsdc.toString(),
          conversionCriteria: body.conversionCriteria,
          deadline: new Date(body.deadline),
        },
        include: { _count: { select: { nodes: true, leaves: true } } },
      });
      return reply.code(201).send(
        mapCampaign(created as unknown as CampaignWithCounts, {
          clickCount: 0,
          conversionsCount: 0,
        }),
      );
    },
  );

  r.post(
    "/campaigns/finalize",
    {
      schema: {
        tags: ["campaigns"],
        summary: "Confirm a campaign draft after on-chain tx is confirmed",
        body: FinalizeCampaignBody,
        response: { 200: CampaignSummarySchema, 404: ErrorBodySchema },
      },
    },
    async (req, reply) => {
      const { draftId, onchainPda } = req.body;
      const draft = await app.prisma.campaignMetadata.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        return reply
          .code(404)
          .send({ error: "campaign_not_found", message: `No draft ${draftId}` });
      }
      const updated = await app.prisma.campaignMetadata.update({
        where: { id: draftId },
        data: { status: "active", onchainPda },
        include: { _count: { select: { nodes: true, leaves: true } } },
      });
      return mapCampaign(updated as unknown as CampaignWithCounts, {
        clickCount: 0,
        conversionsCount: 0,
      });
    },
  );
};

async function getCampaignActivityCounts(
  prisma: import("../generated/prisma/client.js").PrismaClient,
  campaignIds: string[],
): Promise<Map<string, { clickCount: number; conversionsCount: number }>> {
  // Click and conversion counts live on leaves; aggregate by campaign id by
  // joining through leaves_metadata. One round-trip each, parallelized.
  const [clickRows, convRows] = await Promise.all([
    prisma.click.groupBy({
      by: ["leafId"],
      where: { leaf: { campaignId: { in: campaignIds } } },
      _count: { _all: true },
    }) as unknown as Promise<{ leafId: string; _count: { _all: number } }[]>,
    prisma.pendingConversion.groupBy({
      by: ["leafId"],
      where: {
        leaf: { campaignId: { in: campaignIds } },
        status: { in: ["pushed_to_chain", "verified"] },
      },
      _count: { _all: true },
    }) as unknown as Promise<{ leafId: string; _count: { _all: number } }[]>,
  ]);

  const leafToCampaign = new Map<string, string>();
  if (clickRows.length || convRows.length) {
    const leafIds = Array.from(
      new Set([
        ...clickRows.map((r) => r.leafId),
        ...convRows.map((r) => r.leafId),
      ]),
    );
    const leaves = await prisma.leafMetadata.findMany({
      where: { id: { in: leafIds } },
      select: { id: true, campaignId: true },
    });
    for (const l of leaves) leafToCampaign.set(l.id, l.campaignId);
  }

  const out = new Map<
    string,
    { clickCount: number; conversionsCount: number }
  >();
  for (const id of campaignIds) {
    out.set(id, { clickCount: 0, conversionsCount: 0 });
  }
  for (const row of clickRows) {
    const campaignId = leafToCampaign.get(row.leafId);
    if (!campaignId) continue;
    const entry = out.get(campaignId);
    if (entry) entry.clickCount += row._count._all;
  }
  for (const row of convRows) {
    const campaignId = leafToCampaign.get(row.leafId);
    if (!campaignId) continue;
    const entry = out.get(campaignId);
    if (entry) entry.conversionsCount += row._count._all;
  }
  return out;
}

export default campaignsRoutes;
