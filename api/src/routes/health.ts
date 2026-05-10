import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/health",
    {
      schema: {
        tags: ["meta"],
        summary: "Liveness + DB connectivity probe",
        response: {
          200: z.object({
            status: z.literal("ok"),
            db: z.literal("up"),
            uptime: z.number(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async () => {
      await app.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok" as const,
        db: "up" as const,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    },
  );
};

export default healthRoutes;
