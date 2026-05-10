import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import zodPlugin from "./plugins/zod.js";
import corsPlugin from "./plugins/cors.js";
import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import healthRoutes from "./routes/health.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname" } }
          : undefined,
    },
  });

  await app.register(zodPlugin);
  await app.register(corsPlugin);
  await app.register(prismaPlugin);
  await app.register(swaggerPlugin);

  await app.register(healthRoutes);

  return app;
}
