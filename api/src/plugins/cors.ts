import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";

const corsPlugin: FastifyPluginAsync = async (app) => {
  await app.register(cors, {
    origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(","),
    credentials: true,
  });
};

export default fp(corsPlugin, { name: "cors" });
