import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "../plugins/zod.js";
import { ErrorBodySchema } from "../schemas/shared.js";
import { REF_CODE_REGEX } from "../refcode.js";
import { config } from "../config.js";

const ConvertBody = z.object({
  refCode: z.string().regex(REF_CODE_REGEX, "8 lowercase alphanumeric chars"),
  valueUsdc: z.coerce.number().positive().max(10_000),
  buyerWallet: z.string().min(32).max(44).optional(),
  source: z.enum(["demo_buy_page", "manual", "api"]).default("demo_buy_page"),
});

const ConvertResponse = z.object({
  pendingConversionId: z.string(),
  leafId: z.string(),
  status: z.enum(["pending", "pushed_to_chain", "rejected"]),
  txSignature: z.string().nullable(),
  createdAt: z.string(),
});

const demoRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/demo/convert",
    {
      schema: {
        tags: ["demo"],
        summary:
          "Register a conversion (persists a pending row + forwards to oracle webhook if configured)",
        body: ConvertBody,
        response: {
          201: ConvertResponse,
          404: ErrorBodySchema,
          409: ErrorBodySchema,
        },
      },
    },
    async (req, reply) => {
      const { refCode, valueUsdc, buyerWallet, source } = req.body;

      // Load the leaf along with the full genealogical path so the oracle can
      // build register_conversion in one round-trip without re-querying us.
      const leaf = await app.prisma.leafMetadata.findUnique({
        where: { refCode },
        select: {
          id: true,
          status: true,
          campaignId: true,
          onchainPda: true,
          path: true,
          campaign: { select: { onchainPda: true } },
        },
      });
      if (!leaf) {
        return reply.code(404).send({
          error: "ref_code_not_found",
          message: `No leaf for ref_code ${refCode}`,
        });
      }
      if (leaf.status !== "finalized" || !leaf.onchainPda) {
        return reply.code(409).send({
          error: "leaf_not_finalized",
          message: "leaf has not been finalized on-chain yet",
        });
      }
      if (!leaf.campaign.onchainPda) {
        return reply.code(409).send({
          error: "campaign_not_finalized",
          message: "leaf's campaign has not been finalized on-chain yet",
        });
      }

      // Resolve the L1/L2/L3 node PDAs from the leaf's path.
      const pathNodes = await app.prisma.nodeMetadata.findMany({
        where: { id: { in: leaf.path } },
        select: { id: true, onchainPda: true },
      });
      const pathPdaById = new Map(pathNodes.map((n) => [n.id, n.onchainPda]));
      const pdaL1 = pathPdaById.get(leaf.path[0]);
      const pdaL2 = pathPdaById.get(leaf.path[1]);
      const pdaL3 = pathPdaById.get(leaf.path[2]);
      if (!pdaL1 || !pdaL2 || !pdaL3) {
        return reply.code(409).send({
          error: "path_not_onchain",
          message: "one or more nodes on the leaf path are not finalized",
        });
      }

      const created = await app.prisma.pendingConversion.create({
        data: {
          leafId: leaf.id,
          valueUsdc: valueUsdc.toString(),
          sourceData: { buyerWallet: buyerWallet ?? null, source, refCode },
          status: "pending",
        },
      });

      app.events.emit({
        type: "conversion_pending",
        pendingId: created.id,
        leafId: leaf.id,
        valueUsdc: created.valueUsdc.toString(),
      });

      // Forward to the oracle webhook. The oracle signs + sends
      // register_conversion and replies with the tx signature. Fail-soft: if
      // the oracle is unreachable the row stays 'pending' and the oracle
      // poller can retry later.
      let status: "pending" | "pushed_to_chain" | "rejected" = "pending";
      let txSignature: string | null = null;
      if (config.ORACLE_WEBHOOK_URL) {
        try {
          // The contract's conversion_id seed is `[u8; 16]`. The oracle
          // truncates a string to 16 ASCII bytes and pads with zeros. We use
          // the first 16 chars of the pending row's cuid so the indexer can
          // re-derive the PDA from the DB id.
          const conversion_id = created.id.slice(0, 16);

          const res = await fetch(
            `${config.ORACLE_WEBHOOK_URL.replace(/\/$/, "")}/webhook/conversion`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...(config.ORACLE_WEBHOOK_TOKEN
                  ? { authorization: `Bearer ${config.ORACLE_WEBHOOK_TOKEN}` }
                  : {}),
              },
              body: JSON.stringify({
                campaign_pubkey: leaf.campaign.onchainPda,
                leaf_pubkey: leaf.onchainPda,
                node_l1_pubkey: pdaL1,
                node_l2_pubkey: pdaL2,
                node_l3_pubkey: pdaL3,
                conversion_id,
                pending_conversion_cuid: created.id,
                // USDC base units (6 decimals) — matches contract expectations.
                value_usdc: Math.round(valueUsdc * 1_000_000),
                wallet_address: buyerWallet ?? null,
              }),
            },
          );

          if (res.ok) {
            const data = (await res.json()) as { tx?: string };
            txSignature = data.tx ?? null;
            status = "pushed_to_chain";
            await app.prisma.pendingConversion.update({
              where: { id: created.id },
              data: { status: "pushed_to_chain", pushedTxSig: txSignature },
            });
          } else {
            const text = await res.text().catch(() => "");
            app.log.warn(
              { status: res.status, text, pendingId: created.id },
              "oracle webhook rejected conversion",
            );
            // 4xx → keep as 'pending' so the operator can decide whether to
            // retry manually. The oracle poller will retry transient errors.
            if (res.status >= 400 && res.status < 500) {
              await app.prisma.pendingConversion.update({
                where: { id: created.id },
                data: { status: "rejected" },
              });
              status = "rejected";
            }
          }
        } catch (err) {
          app.log.warn(
            { err: String(err), pendingId: created.id },
            "oracle webhook unreachable",
          );
        }
      }

      return reply.code(201).send({
        pendingConversionId: created.id,
        leafId: leaf.id,
        status,
        txSignature,
        createdAt: created.createdAt.toISOString(),
      });
    },
  );
};

export default demoRoutes;
