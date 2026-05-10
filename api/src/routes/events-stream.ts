import type { FastifyPluginAsync } from "fastify";

const KEEPALIVE_MS = 15_000;

const eventsStreamRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/events/stream",
    {
      schema: {
        tags: ["events"],
        summary: "Server-Sent Events stream of tree mutations",
        description:
          "Long-lived text/event-stream. Emits one of: node_created, leaf_created, click, conversion_pending, conversion_confirmed. Frames are JSON-encoded in the SSE `data:` field. Response schema is omitted because the body is a streamed sequence, not a single payload.",
      },
    },
    async (req, reply) => {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      reply.raw.write(": connected\n\n");

      const unsubscribe = app.events.subscribe((event) => {
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      const keepalive = setInterval(() => {
        reply.raw.write(": keepalive\n\n");
      }, KEEPALIVE_MS);

      const close = () => {
        clearInterval(keepalive);
        unsubscribe();
        if (!reply.raw.writableEnded) reply.raw.end();
      };
      req.raw.on("close", close);
      req.raw.on("error", close);

      return reply;
    },
  );
};

export default eventsStreamRoutes;
