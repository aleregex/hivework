import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

const zodPlugin: FastifyPluginAsync = async (app) => {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
};

export default fp(zodPlugin, { name: "zod" });
export type { ZodTypeProvider };
