import type Anthropic from "@anthropic-ai/sdk";
import type { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { connectMcpClient } from "./mcp-client.js";
import { anthropic, MODEL } from "./anthropic-client.js";
import { PERSONA_NAME, SYSTEM_PROMPT } from "./persona.js";
import { config } from "./config.js";
import {
  SUBMIT_NODE_PLAN_TOOL,
  nodePlanSchema,
  type NodeLevel,
  type NodePlan,
  type NodePlanItem,
  STAKE_SOL_BY_LEVEL,
} from "./plan-schema.js";
import { gateBeforeCreate, recordCreated } from "./limits.js";
import {
  loadAgentSigner,
  signAndSendBase64Tx,
  type AgentSigner,
} from "./wallet.js";
import { watchNewCampaigns, type CampaignSummary } from "./discovery.js";

type McpToolNames = Set<string>;

const LEVEL_TO_MCP: Record<NodeLevel, "L1" | "L2" | "L3"> = {
  1: "L1",
  2: "L2",
  3: "L3",
};

async function callMcpToolText(
  mcp: McpClient,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string | null; isError: boolean }> {
  const result = await mcp.callTool({ name, arguments: args });
  const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
  const text = content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");
  return { text: text.length > 0 ? text : null, isError: Boolean(result.isError) };
}

async function fetchTreeContext(
  mcp: McpClient,
  toolNames: McpToolNames,
  campaignId: string,
): Promise<string> {
  if (!toolNames.has("get_tree")) {
    return "(get_tree not exposed by MCP — assume empty tree)";
  }
  try {
    const { text, isError } = await callMcpToolText(mcp, "get_tree", {
      campaign_id: campaignId,
    });
    if (isError) return `(get_tree errored: ${text ?? "unknown"})`;
    return text ?? "(get_tree returned no content)";
  } catch (err) {
    return `(get_tree threw: ${(err as Error).message})`;
  }
}

function extractToolUse(
  response: Anthropic.Message,
  toolName: string,
): { input: unknown; id: string } | null {
  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === toolName) {
      return { input: block.input, id: block.id };
    }
  }
  return null;
}

function buildUserPrompt(c: CampaignSummary, treeContext: string): string {
  return [
    "A new Hivework campaign just appeared. Decide which 3–5 marketing-decision",
    "nodes to add. Call `submit_node_plan` exactly once.",
    "",
    "## Campaign",
    `campaign_id: ${c.id}`,
    `brand: ${c.brand.name}`,
    `product: ${c.product.name}`,
    `product_description: ${c.product.description}`,
    `pool_usdc: ${c.poolUsdc}`,
    `redirect_url: ${c.redirectUrl}`,
    "",
    "## Current tree (from MCP get_tree)",
    treeContext,
  ].join("\n");
}

async function planNodes(
  c: CampaignSummary,
  treeContext: string,
): Promise<NodePlan | null> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserPrompt(c, treeContext) },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [SUBMIT_NODE_PLAN_TOOL],
      tool_choice: { type: "tool", name: "submit_node_plan" },
      messages,
    });

    console.log(
      `[${PERSONA_NAME}] plan attempt ${attempt} | stop_reason=${response.stop_reason} | usage=${JSON.stringify(response.usage)}`,
    );

    const toolUse = extractToolUse(response, "submit_node_plan");
    if (!toolUse) {
      console.warn(`[${PERSONA_NAME}:agent error] no tool_use in response`);
      return null;
    }

    const parsed = nodePlanSchema.safeParse(toolUse.input);
    if (parsed.success) return parsed.data;

    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    console.warn(
      `[${PERSONA_NAME}:agent error] plan invalid (attempt ${attempt}): ${issues}`,
    );
    if (attempt === 2) return null;

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUse.id,
          is_error: true,
          content: `Your plan failed validation: ${issues}. Fix the issues and call submit_node_plan again.`,
        },
      ],
    });
  }
  return null;
}

type CreateNodeResult = {
  node_id?: string;
  status?: "draft_only" | "pending_program";
  unsigned_tx_b64?: string | null;
  fee_payer?: string | null;
  expected_program_id?: string | null;
  tx_signature?: string | null;
};

function parseCreateNodeResult(text: string): CreateNodeResult | null {
  try {
    return JSON.parse(text) as CreateNodeResult;
  } catch {
    return null;
  }
}

async function executeNode(
  mcp: McpClient,
  toolNames: McpToolNames,
  campaignId: string,
  node: NodePlanItem,
  signer: AgentSigner,
  index: number,
  total: number,
): Promise<void> {
  const stake = STAKE_SOL_BY_LEVEL[node.level];
  const mcpLevel = LEVEL_TO_MCP[node.level];
  console.log(
    `[${PERSONA_NAME}:agent reasoning] (${index}/${total}) ${mcpLevel} "${node.title}" — ${node.rationale}`,
  );

  const gate = gateBeforeCreate(node.level);
  if (!gate.ok) {
    console.log(
      `[${PERSONA_NAME}:agent skipped] level=${mcpLevel} reason=rate_limit retry_in_ms=${gate.retryAfterMs}`,
    );
    return;
  }

  if (!toolNames.has("create_node")) {
    console.warn(
      `[${PERSONA_NAME}:agent skipped] level=${mcpLevel} reason=mcp_missing_create_node`,
    );
    return;
  }

  try {
    const { text, isError } = await callMcpToolText(mcp, "create_node", {
      campaign_id: campaignId,
      parent_id: node.parent_node_id,
      level: mcpLevel,
      metadata: {
        title: node.title,
        description: node.description,
        examples: node.examples.map((e) => ({ text: e })),
        tags: node.tags,
        media_urls: [],
        creator_wallet: signer.address,
      },
      stake: { auto: true },
    });

    if (isError || !text) {
      console.warn(
        `[${PERSONA_NAME}:agent error] create_node returned error: ${text ?? "(no content)"}`,
      );
      return;
    }

    const result = parseCreateNodeResult(text);
    if (!result) {
      console.warn(
        `[${PERSONA_NAME}:agent error] create_node response unparseable: ${text.slice(0, 200)}`,
      );
      return;
    }

    if (result.status === "pending_program") {
      console.log(
        `[${PERSONA_NAME}:agent created] level=${mcpLevel} node=${result.node_id ?? "(?)"} status=pending_program (Group A program not deployed yet — draft persisted)`,
      );
      return;
    }

    if (!result.unsigned_tx_b64) {
      console.warn(
        `[${PERSONA_NAME}:agent error] create_node status=draft_only but no unsigned_tx_b64`,
      );
      return;
    }

    if (!config.ENABLE_ONCHAIN) {
      console.log(
        `[${PERSONA_NAME}:agent dry-run] level=${mcpLevel} node=${result.node_id ?? "(?)"} stake=${stake}SOL — skipped on-chain submit (ENABLE_ONCHAIN=false)`,
      );
      return;
    }

    const sig = await signAndSendBase64Tx(result.unsigned_tx_b64, signer);
    recordCreated(node.level);
    console.log(
      `[${PERSONA_NAME}:agent created] level=${mcpLevel} node=${result.node_id ?? "(?)"} tx=${sig}`,
    );
  } catch (err) {
    console.warn(
      `[${PERSONA_NAME}:agent error] create failed level=${mcpLevel}: ${(err as Error).message}`,
    );
  }
}

async function handleCampaign(
  c: CampaignSummary,
  mcp: McpClient,
  toolNames: McpToolNames,
  signer: AgentSigner,
): Promise<void> {
  console.log(
    `[${PERSONA_NAME}] new campaign ${c.id} (${c.brand.name} / ${c.product.name})`,
  );
  const treeContext = await fetchTreeContext(mcp, toolNames, c.id);

  const plan = await planNodes(c, treeContext);
  if (!plan) return;

  console.log(`[${PERSONA_NAME}:agent reasoning] ${plan.reasoning_summary}`);

  for (let i = 0; i < plan.nodes.length; i++) {
    await executeNode(
      mcp,
      toolNames,
      c.id,
      plan.nodes[i],
      signer,
      i + 1,
      plan.nodes.length,
    );
  }
}

async function main(): Promise<void> {
  console.log(
    `[${PERSONA_NAME}] booting | mcp=${config.MCP_URL} | api=${config.B1_API_URL} | model=${MODEL} | onchain=${config.ENABLE_ONCHAIN}`,
  );

  const signer = await loadAgentSigner();
  console.log(`[${PERSONA_NAME}] wallet=${signer.address}`);

  const mcp = await connectMcpClient();
  const tools = await mcp.listTools();
  const toolNames: McpToolNames = new Set(tools.tools.map((t) => t.name));
  console.log(
    `[${PERSONA_NAME}] mcp tools: ${[...toolNames].join(", ") || "(none)"}`,
  );

  const abort = new AbortController();
  const shutdown = async (sig: string): Promise<void> => {
    console.log(`[${PERSONA_NAME}] received ${sig}, shutting down`);
    abort.abort();
    try {
      await mcp.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  for await (const c of watchNewCampaigns(abort.signal)) {
    try {
      await handleCampaign(c, mcp, toolNames, signer);
    } catch (err) {
      console.warn(
        `[${PERSONA_NAME}:agent error] handler crashed for ${c.id}: ${(err as Error).message}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(`[${PERSONA_NAME}] fatal`, err);
  process.exit(1);
});
