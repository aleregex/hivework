import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "../plugins/zod.js";
import {
  CreateLeafDraftBody,
  CreateLeafDraftResponse,
  FinalizeLeafBody,
  LeafSchema,
  mapLeaf,
} from "../schemas/leaf.js";
import { ErrorBodySchema } from "../schemas/shared.js";
import { consumeRefCode, reserveRefCode } from "../refcode.js";

const leavesRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/leaves/draft",
    {
      schema: {
        tags: ["leaves"],
        summary: "Create a leaf draft + reserve a fresh ref_code",
        body: CreateLeafDraftBody,
        response: { 201: CreateLeafDraftResponse, 400: ErrorBodySchema, 404: ErrorBodySchema },
      },
    },
    async (req, reply) => {
      const body = req.body;

      // Validate path: 3 nodes, all in the same campaign, levels L1/L2/L3 in order.
      const pathNodes = await app.prisma.nodeMetadata.findMany({
        where: { id: { in: body.path } },
        select: { id: true, campaignId: true, level: true, parentNodeId: true, status: true },
      });
      if (pathNodes.length !== 3) {
        return reply
          .code(400)
          .send({ error: "path_invalid", message: "path must reference 3 existing nodes" });
      }
      const byId = new Map(pathNodes.map((n) => [n.id, n]));
      const ordered = body.path.map((id) => byId.get(id)!);
      const levels = ordered.map((n) => n.level);
      if (levels[0] !== "L1" || levels[1] !== "L2" || levels[2] !== "L3") {
        return reply
          .code(400)
          .send({ error: "path_levels_invalid", message: "path must be [L1, L2, L3]" });
      }
      if (
        ordered.some((n) => n.campaignId !== body.campaignId) ||
        ordered[1].parentNodeId !== ordered[0].id ||
        ordered[2].parentNodeId !== ordered[1].id
      ) {
        return reply
          .code(400)
          .send({
            error: "path_genealogy_invalid",
            message: "path nodes are not genealogically connected",
          });
      }

      const draft = await app.prisma.leafMetadata.create({
        data: {
          campaignId: body.campaignId,
          path: body.path,
          creatorWallet: body.creatorWallet,
          // Temporary placeholder; replaced by reserveRefCode below in the same logical op.
          // We use the leaf id as the reservation key once it exists.
          refCode: `tmp_${Math.random().toString(36).slice(2, 12)}`,
          contentUrl: body.contentUrl ?? null,
          platform: body.platform,
          stakeSol: body.stakeSol.toString(),
          status: "draft",
        },
      });

      const reservation = await reserveRefCode(app.prisma, draft.id);
      const updated = await app.prisma.leafMetadata.update({
        where: { id: draft.id },
        data: { refCode: reservation.refCode },
      });

      return reply.code(201).send({
        leaf: mapLeaf(updated),
        reservation: {
          refCode: reservation.refCode,
          expiresAt: reservation.expiresAt.toISOString(),
        },
      });
    },
  );

  r.post(
    "/leaves/finalize",
    {
      schema: {
        tags: ["leaves"],
        summary: "Confirm a leaf draft + consume its ref_code reservation",
        body: FinalizeLeafBody,
        response: { 200: LeafSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
      },
    },
    async (req, reply) => {
      const { draftId, refCode, onchainPda } = req.body;

      const draft = await app.prisma.leafMetadata.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        return reply
          .code(404)
          .send({ error: "leaf_not_found", message: `No draft ${draftId}` });
      }
      if (draft.refCode !== refCode) {
        return reply.code(409).send({
          error: "ref_code_mismatch",
          message: "ref_code does not match the draft's reservation",
        });
      }

      const consumed = await consumeRefCode(app.prisma, refCode);
      if (!consumed) {
        return reply.code(409).send({
          error: "ref_code_expired",
          message: "ref_code reservation expired or was already consumed",
        });
      }

      const updated = await app.prisma.leafMetadata.update({
        where: { id: draftId },
        data: { status: "finalized", onchainPda },
      });

      app.events.emit({
        type: "leaf_created",
        campaignId: updated.campaignId,
        leafId: updated.id,
        refCode: updated.refCode,
        creatorWallet: updated.creatorWallet,
      });

      return mapLeaf(updated);
    },
  );
};

export default leavesRoutes;
