import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { config } from "../config.js";

const swaggerPlugin: FastifyPluginAsync = async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Hivework API",
        description: "Backend de metadata, indexer del árbol y endpoints del demo.",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
  });
};

export default fp(swaggerPlugin, { name: "swagger" });
