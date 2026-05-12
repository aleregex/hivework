import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const NODE_LEVELS = [1, 2, 3] as const;
export type NodeLevel = (typeof NODE_LEVELS)[number];

// Mirrors L1/L2/L3_STAKE_AMOUNT in Contract/programs/hivework/src/constants.rs.
// Update in lockstep with that file (and web/lib/anchor/stakes.ts).
export const STAKE_SOL_BY_LEVEL: Record<NodeLevel, number> = {
  1: 0.0006,
  2: 0.0003,
  3: 0.00015,
};

export const nodePlanItemSchema = z
  .object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    parent_node_id: z.string().min(1).nullable(),
    title: z.string().min(1).max(80),
    description: z.string().min(1).max(500),
    tags: z.array(z.string().min(1)).min(2).max(5),
    examples: z.array(z.string().min(1)).min(1).max(3),
    rationale: z.string().min(1).max(400),
  })
  .superRefine((node, ctx) => {
    if (node.level === 1 && node.parent_node_id !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "level 1 nodes must have parent_node_id = null",
        path: ["parent_node_id"],
      });
    }
    if (node.level !== 1 && node.parent_node_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `level ${node.level} nodes require a non-null parent_node_id`,
        path: ["parent_node_id"],
      });
    }
  });

export const nodePlanSchema = z.object({
  campaign_id: z.string().min(1),
  reasoning_summary: z.string().min(1).max(400),
  nodes: z.array(nodePlanItemSchema).min(3).max(5),
});

export type NodePlan = z.infer<typeof nodePlanSchema>;
export type NodePlanItem = z.infer<typeof nodePlanItemSchema>;

export const SUBMIT_NODE_PLAN_TOOL: Anthropic.Tool = {
  name: "submit_node_plan",
  description:
    "Submit your final plan of 3 to 5 marketing-decision nodes for the campaign. " +
    "Call this tool exactly once. Do not emit prose outside the tool call.",
  input_schema: {
    type: "object",
    required: ["campaign_id", "reasoning_summary", "nodes"],
    properties: {
      campaign_id: { type: "string" },
      reasoning_summary: {
        type: "string",
        description: "1–2 sentences explaining the overall strategy.",
        maxLength: 400,
      },
      nodes: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          required: [
            "level",
            "parent_node_id",
            "title",
            "description",
            "tags",
            "examples",
            "rationale",
          ],
          properties: {
            level: { type: "integer", enum: [1, 2, 3] },
            parent_node_id: {
              type: ["string", "null"],
              description:
                "Must be null when level === 1; otherwise the id of an existing node at the parent level.",
            },
            title: { type: "string", maxLength: 80 },
            description: { type: "string", maxLength: 500 },
            tags: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 5,
            },
            examples: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 3,
            },
            rationale: {
              type: "string",
              maxLength: 400,
              description:
                "1–2 sentences on which gap this fills and why it should convert. Printed to stdout for judges.",
            },
          },
        },
      },
    },
  },
};
