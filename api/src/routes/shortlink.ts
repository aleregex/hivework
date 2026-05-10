import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";
import { ErrorBodySchema } from "../schemas/shared.js";
import { REF_CODE_REGEX } from "../refcode.js";

function hash(value: string | undefined | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

const shortlinkRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/l/:refCode",
    {
      schema: {
        tags: ["shortlink"],
        summary: "Track click and 302 to the campaign storefront",
        params: z.object({ refCode: z.string().regex(REF_CODE_REGEX) }),
        response: { 302: z.null(), 404: ErrorBodySchema },
      },
    },
    async (req, reply) => {
      const { refCode } = req.params;

      const leaf = await app.prisma.leafMetadata.findUnique({
        where: { refCode },
        include: { campaign: { select: { redirectUrl: true } } },
      });
      if (!leaf || leaf.status !== "finalized") {
        return reply
          .code(404)
          .send({ error: "ref_code_not_found", message: `No finalized leaf for ${refCode}` });
      }

      // Fire-and-forget click insert. We must not block the redirect on a DB
      // round-trip — every ms of latency hurts conversion. setImmediate keeps
      // it on the same process; if the insert fails we just log it.
      const ipHash = hash(req.ip);
      const userAgentHash = hash(req.headers["user-agent"]);
      const referrer = req.headers["referer"] ?? req.headers["referrer"];
      setImmediate(() => {
        app.prisma.click
          .create({
            data: {
              leafId: leaf.id,
              ipHash,
              userAgentHash,
              referrer: typeof referrer === "string" ? referrer : null,
            },
          })
          .then(() => {
            app.events.emit({ type: "click", leafId: leaf.id, refCode });
          })
          .catch((err: unknown) => {
            app.log.warn({ err, refCode }, "click insert failed");
          });
      });

      return reply.redirect(leaf.campaign.redirectUrl, 302);
    },
  );
};

export default shortlinkRoutes;
