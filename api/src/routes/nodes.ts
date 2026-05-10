import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";
import {
  CreateNodeDraftBody,
  FinalizeNodeBody,
  NodeSchema,
  mapNode,
} from "../schemas/node.js";
import { ErrorBodySchema } from "../schemas/shared.js";

const nodesRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/nodes/draft",
    {
      schema: {
        tags: ["nodes"],
        summary: "Create a node draft (off-chain only)",
        body: CreateNodeDraftBody,
        response: { 201: NodeSchema, 404: ErrorBodySchema, 400: ErrorBodySchema },
      },
    },
    async (req, reply) => {
      const body = req.body;

      const campaign = await app.prisma.campaignMetadata.findUnique({
        where: { id: body.campaignId },
        select: { id: true },
      });
      if (!campaign) {
        return reply.code(404).send({
          error: "campaign_not_found",
          message: `No campaign ${body.campaignId}`,
        });
      }

      if (body.parentNodeId) {
        const parent = await app.prisma.nodeMetadata.findUnique({
          where: { id: body.parentNodeId },
          select: { campaignId: true, level: true },
        });
        if (!parent || parent.campaignId !== body.campaignId) {
          return reply.code(400).send({
            error: "parent_invalid",
            message: "parent_node_id is not in the same campaign",
          });
        }
        const expected = body.level === "L2" ? "L1" : body.level === "L3" ? "L2" : null;
        if (expected !== parent.level) {
          return reply.code(400).send({
            error: "parent_level_mismatch",
            message: `${body.level} requires a ${expected ?? "null"} parent, got ${parent.level}`,
          });
        }
      } else if (body.level !== "L1") {
        return reply.code(400).send({
          error: "parent_required",
          message: `${body.level} nodes need a parent_node_id`,
        });
      }

      const created = await app.prisma.nodeMetadata.create({
        data: {
          campaignId: body.campaignId,
          level: body.level,
          parentNodeId: body.parentNodeId ?? null,
          creatorWallet: body.creatorWallet,
          title: body.title,
          description: body.description,
          examples: (body.examples ?? null) as never,
          tags: body.tags,
          mediaUrls: body.mediaUrls,
          stakeSol: body.stakeSol.toString(),
          status: "draft",
        },
      });

      return reply.code(201).send(mapNode(created));
    },
  );

  r.post(
    "/nodes/finalize",
    {
      schema: {
        tags: ["nodes"],
        summary: "Confirm a node draft after on-chain tx is confirmed",
        body: FinalizeNodeBody,
        response: { 200: NodeSchema, 404: ErrorBodySchema },
      },
    },
    async (req, reply) => {
      const { draftId, onchainPda } = req.body;
      const draft = await app.prisma.nodeMetadata.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        return reply
          .code(404)
          .send({ error: "node_not_found", message: `No draft ${draftId}` });
      }

      const updated = await app.prisma.nodeMetadata.update({
        where: { id: draftId },
        data: { status: "finalized", onchainPda },
      });

      // Bump parent fork_count exactly once: when the child becomes finalized.
      if (updated.parentNodeId && draft.status !== "finalized") {
        await app.prisma.nodeMetadata.update({
          where: { id: updated.parentNodeId },
          data: { forkCount: { increment: 1 } },
        });
      }

      app.events.emit({
        type: "node_created",
        campaignId: updated.campaignId,
        nodeId: updated.id,
        level: updated.level,
        creatorWallet: updated.creatorWallet,
      });

      return mapNode(updated);
    },
  );
};

export default nodesRoutes;
