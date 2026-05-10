import { EventEmitter } from "node:events";
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { HiveEvent } from "../events.js";

const CHANNEL = "hive";

export type EventBus = {
  emit: (event: HiveEvent) => void;
  subscribe: (handler: (event: HiveEvent) => void) => () => void;
};

declare module "fastify" {
  interface FastifyInstance {
    events: EventBus;
  }
}

const eventBusPlugin: FastifyPluginAsync = async (app) => {
  const bus = new EventEmitter();
  bus.setMaxListeners(100);

  const api: EventBus = {
    emit(event) {
      bus.emit(CHANNEL, event);
    },
    subscribe(handler) {
      bus.on(CHANNEL, handler);
      return () => bus.off(CHANNEL, handler);
    },
  };

  app.decorate("events", api);
};

export default fp(eventBusPlugin, { name: "event-bus" });
