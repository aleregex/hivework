"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Send, Sparkles, User } from "lucide-react";
import { MOCK_TREE, type TreeNode } from "@/lib/mocks/tree";

/* ------------------------------------------------------------------ *
 * Mocked agent chat. Deterministic responses keyed off keywords so
 * the demo always lands. The agent's "suggest path" button hands the
 * caller a (hookId, audioId, visualId) triple it can plug straight
 * into the publish flow.
 * ------------------------------------------------------------------ */

type Message =
  | { role: "agent"; kind: "text"; text: string }
  | { role: "agent"; kind: "suggestion"; text: string; path: PathSuggestion }
  | { role: "user"; text: string };

export type PathSuggestion = {
  hookId: string;
  audioId: string;
  visualId: string;
  reason: string;
};

type Props = {
  onAcceptPath: (path: PathSuggestion) => void;
};

const HELLO: Message = {
  role: "agent",
  kind: "text",
  text:
    "Hey — I'm the hivework agent. Tell me about your audience (niche, platform, vibe) and I'll suggest a path with the highest expected payout for you.",
};

export function AgentChatPanel({ onAcceptPath }: Props) {
  const [messages, setMessages] = useState<Message[]>([HELLO]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stick to bottom on new messages (chat behavior).
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const send = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setThinking(true);

    // Mock streaming-ish delay so it feels responsive but not instant.
    window.setTimeout(() => {
      const reply = respondTo(trimmed);
      setMessages((m) => [...m, ...reply]);
      setThinking(false);
    }, 700 + Math.random() * 500);
  };

  return (
    <aside className="flex h-full min-h-[440px] flex-col rounded-lg border border-line bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md border border-live/30 bg-live/10">
            <Bot className="h-3.5 w-3.5 text-live" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">hivework agent</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              mcp · gpt-cola-001
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          beta
        </span>
      </header>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, i) => (
          <Bubble key={i} message={m} onAcceptPath={onAcceptPath} />
        ))}
        {thinking && <ThinkingBubble />}
      </div>

      {/* Quick prompts — clickable shortcuts so the demo doesn't need typing */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="rounded-full border border-line bg-ink-2 px-2.5 py-1 font-mono text-[10px] text-muted transition-colors hover:border-honey/40 hover:bg-honey/5 hover:text-honey"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        className="flex items-center gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell the agent about your audience…"
          className="h-9 flex-1 rounded-md border border-line bg-ink-2 px-3 text-sm placeholder:text-faint focus:border-honey/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-honey text-ink transition-opacity hover:bg-honey-soft disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}

const QUICK_PROMPTS = [
  "I do fitness on TikTok",
  "Web3 audience, X/Twitter",
  "Suggest the highest-paying path",
];

function Bubble({
  message,
  onAcceptPath,
}: {
  message: Message;
  onAcceptPath: (path: PathSuggestion) => void;
}) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end gap-2"
      >
        <div className="max-w-[85%] rounded-md rounded-br-none bg-foreground/10 px-3 py-2 text-sm leading-snug text-foreground">
          {message.text}
        </div>
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
          <User className="h-3 w-3" />
        </span>
      </motion.div>
    );
  }
  if (message.kind === "suggestion") {
    const path = message.path;
    const hook = MOCK_TREE.find((n) => n.id === path.hookId);
    const audio = MOCK_TREE.find((n) => n.id === path.audioId);
    const visual = MOCK_TREE.find((n) => n.id === path.visualId);
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2"
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-live/30 bg-live/10 text-live">
          <Bot className="h-3 w-3" />
        </span>
        <div className="max-w-[88%] rounded-md rounded-bl-none border border-honey/30 bg-honey/[0.04] p-3">
          <p className="text-sm leading-snug text-foreground">{message.text}</p>
          <div className="mt-2.5 space-y-1 rounded-md border border-line bg-ink-2 p-2.5 font-mono text-[11px] leading-relaxed text-fg-soft">
            <PathRow label="L1" node={hook} />
            <PathRow label="L2" node={audio} />
            <PathRow label="L3" node={visual} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            <span className="text-honey">why · </span>
            {path.reason}
          </p>
          <button
            onClick={() => onAcceptPath(path)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-honey px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink transition-colors hover:bg-honey-soft"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Use this path
          </button>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-live/30 bg-live/10 text-live">
        <Bot className="h-3 w-3" />
      </span>
      <div className="max-w-[85%] rounded-md rounded-bl-none border border-line bg-ink-2 px-3 py-2 text-sm leading-snug text-fg-soft">
        {message.text}
      </div>
    </motion.div>
  );
}

function PathRow({ label, node }: { label: string; node?: TreeNode }) {
  if (!node) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-faint">{label}</span>
      <ArrowRight className="h-3 w-3 text-faint" />
      <span className="truncate text-foreground">{node.title}</span>
      <span className="ml-auto text-sting tabular">
        {node.conversions}c
      </span>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-live/30 bg-live/10 text-live">
        <Bot className="h-3 w-3" />
      </span>
      <div className="rounded-md rounded-bl-none border border-line bg-ink-2 px-3 py-2.5">
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted"
              style={{
                animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </span>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
            40% { opacity: 1; transform: translateY(-3px); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Mock response logic. Pure function of the input string. We pick from
 * canned suggestions based on keyword matches, falling back to the
 * "highest paying path right now" recommendation.
 * ------------------------------------------------------------------ */

function respondTo(text: string): Message[] {
  const lower = text.toLowerCase();

  // Path A — hot path (h2 → a3 → v3)
  const HOT_PATH: PathSuggestion = {
    hookId: "h2",
    audioId: "a3",
    visualId: "v3",
    reason:
      "This composition has the highest realized payout right now ($86 across 25 conversions). The trending audio expires in ~6 days, but in the next 48h it's the highest expected $/post.",
  };

  // Path B — emotional path (h1 → a1 → v1)
  const EMO_PATH: PathSuggestion = {
    hookId: "h1",
    audioId: "a1",
    visualId: "v1",
    reason:
      "Lower volume but very stable conversion rate (12/sec). Best fit for a creator with an emotional / lifestyle audience — the lo-fi audio + condensation visual reads as 'cinematic ad'.",
  };

  if (
    /high|max|best|paying|top|hot|trending|tiktok|reach|viral/.test(lower)
  ) {
    return [
      {
        role: "agent",
        kind: "text",
        text:
          "Based on the live tree state, here's the highest-paying path right now:",
      },
      {
        role: "agent",
        kind: "suggestion",
        text: "Recommended path · max payout right now",
        path: HOT_PATH,
      },
    ];
  }

  if (/fitness|wellness|cooking|food|life|emotional|cinem|vlog/.test(lower)) {
    return [
      {
        role: "agent",
        kind: "text",
        text:
          "Got it — for that audience the lifestyle path tends to convert better than the challenger angle:",
      },
      {
        role: "agent",
        kind: "suggestion",
        text: "Suggested path · lifestyle audience",
        path: EMO_PATH,
      },
    ];
  }

  if (/web3|crypto|nft|dao|token/.test(lower)) {
    return [
      {
        role: "agent",
        kind: "text",
        text:
          "Halo Cola is consumer, but for a web3 audience the challenger angle resonates with the 'old vs new guard' narrative. Try this:",
      },
      {
        role: "agent",
        kind: "suggestion",
        text: "Suggested path · challenger angle",
        path: HOT_PATH,
      },
    ];
  }

  return [
    {
      role: "agent",
      kind: "text",
      text:
        "Cool. I'll need a hint about your platform or vibe to optimize. Or I can just show you the path with the highest current payout — say 'best paying' and I'll pull it.",
    },
  ];
}
