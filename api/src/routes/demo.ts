import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";
import { ErrorBodySchema } from "../schemas/shared.js";
import { REF_CODE_REGEX } from "../refcode.js";

const ConvertBody = z.object({
  refCode: z.string().regex(REF_CODE_REGEX, "8 lowercase alphanumeric chars"),
  valueUsdc: z.coerce.number().positive().max(10_000),
  buyerWallet: z.string().min(32).max(44).optional(),
  source: z.enum(["demo_buy_page", "manual", "api"]).default("demo_buy_page"),
});

const ConvertResponse = z.object({
  pendingConversionId: z.string(),
  leafId: z.string(),
  status: z.literal("pending"),
  createdAt: z.string(),
});

const demoRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/demo/convert",
    {
      schema: {
        tags: ["demo"],
        summary: "Simulate a conversion (writes pending_conversions for the oracle)",
        body: ConvertBody,
        response: {
          201: ConvertResponse,
          404: ErrorBodySchema,
          409: ErrorBodySchema,
        },
      },
    },
    async (req, reply) => {
      const { refCode, valueUsdc, buyerWallet, source } = req.body;

      const leaf = await app.prisma.leafMetadata.findUnique({
        where: { refCode },
        select: { id: true, status: true, campaignId: true },
      });
      if (!leaf) {
        return reply.code(404).send({
          error: "ref_code_not_found",
          message: `No leaf for ref_code ${refCode}`,
        });
      }
      if (leaf.status !== "finalized") {
        return reply.code(409).send({
          error: "leaf_not_finalized",
          message: "leaf draft has not been finalized on-chain yet",
        });
      }

      const created = await app.prisma.pendingConversion.create({
        data: {
          leafId: leaf.id,
          valueUsdc: valueUsdc.toString(),
          sourceData: { buyerWallet: buyerWallet ?? null, source, refCode },
          status: "pending",
        },
      });

      app.events.emit({
        type: "conversion_pending",
        pendingId: created.id,
        leafId: leaf.id,
        valueUsdc: created.valueUsdc.toString(),
      });

      return reply.code(201).send({
        pendingConversionId: created.id,
        leafId: leaf.id,
        status: "pending" as const,
        createdAt: created.createdAt.toISOString(),
      });
    },
  );
};

export default demoRoutes;
