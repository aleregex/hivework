import type Anthropic from "@anthropic-ai/sdk";
import { connectMcpClient } from "./mcp-client.js";
import { anthropic, MODEL } from "./anthropic-client.js";
import { PERSONA_NAME, SYSTEM_PROMPT } from "./persona.js";
import { config } from "./config.js";

const MAX_TURNS = 5;

async function main(): Promise<void> {
  console.log(
    `[${PERSONA_NAME}] booting agent | mcp=${config.MCP_URL} | model=${MODEL}`,
  );

  const mcp = await connectMcpClient();
  console.log(`[${PERSONA_NAME}] MCP connected`);

  const toolsResp = await mcp.listTools();
  console.log(
    `[${PERSONA_NAME}] discovered ${toolsResp.tools.length} tool(s): ${toolsResp.tools
      .map((t) => t.name)
      .join(", ")}`,
  );

  const anthropicTools = toolsResp.tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
  }));

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "List the currently active Hivework campaigns and summarize what you find in two sentences.",
    },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    console.log(`\n[${PERSONA_NAME}] --- turn ${turn} ---`);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: anthropicTools,
      messages,
    });

    console.log(
      `[${PERSONA_NAME}] stop_reason=${response.stop_reason} | usage:`,
      response.usage,
    );

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`[${PERSONA_NAME}:text] ${block.text}`);
      } else if (block.type === "tool_use") {
        console.log(
          `[${PERSONA_NAME}:tool_use] ${block.name}(${JSON.stringify(block.input)})`,
        );
      }
    }

    if (response.stop_reason === "end_turn") {
      console.log(`[${PERSONA_NAME}] done`);
      break;
    }

    if (response.stop_reason !== "tool_use") {
      console.warn(
        `[${PERSONA_NAME}] unexpected stop_reason ${response.stop_reason}, halting`,
      );
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const result = await mcp.callTool({
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result.content),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Tool error: ${message}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  await mcp.close();
}

main().catch((err) => {
  console.error("[apis] fatal", err);
  process.exit(1);
});
