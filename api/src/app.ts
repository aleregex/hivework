import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import zodPlugin from "./plugins/zod.js";
import corsPlugin from "./plugins/cors.js";
import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import eventBusPlugin from "./plugins/event-bus.js";
import healthRoutes from "./routes/health.js";
import campaignsRoutes from "./routes/campaigns.js";
import nodesRoutes from "./routes/nodes.js";
import leavesRoutes from "./routes/leaves.js";
import walletsRoutes from "./routes/wallets.js";
import shortlinkRoutes from "./routes/shortlink.js";
import demoRoutes from "./routes/demo.js";
import eventsStreamRoutes from "./routes/events-stream.js";

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
  await app.register(eventBusPlugin);
  await app.register(swaggerPlugin);

  await app.register(healthRoutes);
  await app.register(campaignsRoutes);
  await app.register(nodesRoutes);
  await app.register(leavesRoutes);
  await app.register(walletsRoutes);
  await app.register(shortlinkRoutes);
  await app.register(demoRoutes);
  await app.register(eventsStreamRoutes);

  return app;
}
