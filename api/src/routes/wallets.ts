import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";
import { mapNode, NodeSchema } from "../schemas/node.js";
import { LeafSchema, mapLeaf } from "../schemas/leaf.js";
import { PubkeySchema } from "../schemas/shared.js";

const walletsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/wallets/:address/portfolio",
    {
      schema: {
        tags: ["wallets"],
        summary: "Everything a wallet has authored: nodes + leaves",
        params: z.object({ address: PubkeySchema }),
        response: {
          200: z.object({
            wallet: z.string(),
            nodes: z.array(NodeSchema),
            leaves: z.array(LeafSchema),
            stakedSol: z.string(),
          }),
        },
      },
    },
    async (req) => {
      const { address } = req.params;

      const [nodes, leaves] = await Promise.all([
        app.prisma.nodeMetadata.findMany({
          where: { creatorWallet: address },
          orderBy: { createdAt: "desc" },
        }),
        app.prisma.leafMetadata.findMany({
          where: { creatorWallet: address },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Sum staked SOL across all finalized contributions. Cast Decimal to
      // string for consistency with the on-the-wire shape.
      let stakedSol = 0;
      for (const n of nodes) if (n.status === "finalized") stakedSol += Number(n.stakeSol);
      for (const l of leaves) if (l.status === "finalized") stakedSol += Number(l.stakeSol);

      return {
        wallet: address,
        nodes: nodes.map(mapNode),
        leaves: leaves.map(mapLeaf),
        stakedSol: stakedSol.toFixed(9),
      };
    },
  );
};

export default walletsRoutes;
