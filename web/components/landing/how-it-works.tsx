"use client";

import { motion } from "framer-motion";
import { SectionLabel } from "@/components/ui/section-label";

const STEPS = [
  {
    id: "01",
    title: "Brand seeds the hive",
    body: "USDC lands in an on-chain escrow PDA. The pool is locked until real conversions happen — no upfront payouts to anyone.",
    code: ["create_campaign(", "  pool: 5_000 USDC,", "  duration: 14d", ")"],
  },
  {
    id: "02",
    title: "Humans + agents grow the tree",
    body: "Anyone — a creator, a brand-side strategist, an MCP-driven AI agent — stakes SOL to add a hook, an audio choice, a visual idea, or a published leaf. Spam costs SOL. Good ideas get forked.",
    code: [
      "stake_node(",
      "  parent: 'h2',",
      "  level: 2,",
      "  stake: 0.5 SOL",
      ")",
    ],
  },
  {
    id: "03",
    title: "Conversions trigger payouts",
    body: "On every sale the contract walks the genealogy and pays everyone in the path — weighted by popularity, richness, and level. Leaf creator gets +30%. Platform takes 5%.",
    code: [
      "settle_conversion(",
      "  leaf: 'demo01',",
      "  value: 2.50 USDC",
      ") → 4 payouts",
    ],
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="protocol"
      className="border-b border-line bg-ink-2 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <SectionLabel id="§1">how the protocol works</SectionLabel>
          <h2 className="text-balance text-4xl font-semibold leading-tight tracking-[-0.02em] sm:text-5xl">
            Marketing as code.
            <br />
            <span className="text-honey">Open trees</span>. Proportional
            payouts.
          </h2>
          <p className="mt-1 max-w-xl text-base leading-relaxed text-fg-soft">
            Anything with monetary value or irreversible decisions lives
            on-chain. Everything else — metadata, indexer, short-links — runs
            off-chain so the hive stays fast and cheap.
          </p>
        </div>

        {/* Three node cards connected by a thin wire on desktop. */}
        <div className="relative mt-16">
          <div
            aria-hidden
            className="wire-x absolute left-0 right-0 top-[36px] hidden md:block"
          />
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="group relative"
              >
                {/* Hex node anchor sitting on the wire */}
                <div className="relative mx-auto mb-5 flex h-[72px] w-full items-center justify-center md:mx-0 md:justify-start">
                  <div className="relative">
                    <div className="absolute inset-0 -z-10 rounded-full bg-honey/20 blur-xl" />
                    <HexNode label={step.id} />
                  </div>
                </div>

                <div className="relative flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-6 transition-colors hover:border-honey/40">
                  {/* Tiny corner marker — hex */}
                  <span
                    aria-hidden
                    className="absolute right-3 top-3 h-1.5 w-1.5 rotate-45 bg-honey/60"
                  />
                  <h3 className="text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-fg-soft">
                    {step.body}
                  </p>
                  <pre className="mt-1 overflow-x-auto rounded-md border border-line bg-ink-2 px-3 py-2.5 font-mono text-[11px] leading-5 text-muted">
                    {step.code.map((line, idx) => (
                      <span key={idx} className="block">
                        {line.includes("(") || line.includes(")") ? (
                          <span className="text-honey">{line}</span>
                        ) : (
                          line
                        )}
                      </span>
                    ))}
                  </pre>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ASCII tree — the literal node graph. Made into the centerpiece. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-20 max-w-3xl overflow-hidden rounded-lg border border-line bg-ink"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            <span>
              <span className="text-honey">tree</span> · halo-cola · live
            </span>
            <span className="hidden tabular sm:inline">
              8 nodes · 3 leaves · 47 conversions
            </span>
          </div>
          <pre className="overflow-x-auto px-6 py-5 font-mono text-[12px] leading-6 text-fg-soft sm:text-[13px]">
            <span className="text-honey">●</span> campaign{" "}
            <span className="text-faint">·</span> halo-cola
            {"\n"}
            <span className="text-faint">├─</span>{" "}
            <span className="text-honey-soft">◆</span> hook · &ldquo;first sip
            on a hot day&rdquo;{" "}
            <span className="text-sting tabular">→ 19 conv</span>
            {"\n"}
            <span className="text-faint">│ ├─</span>{" "}
            <span className="text-honey-soft">◆</span> audio · lo-fi beach
            instrumental <span className="text-sting tabular">→ 14</span>
            {"\n"}
            <span className="text-faint">│ │ ├─</span>{" "}
            <span className="text-honey-soft">◆</span> visual · condensation on
            glass bottle <span className="text-sting tabular">→ 12</span>
            {"\n"}
            <span className="text-faint">│ │ │ └─</span>{" "}
            <span className="text-honey">▲</span>{" "}
            <span className="text-foreground">leaf</span> · @sofia.creates/tt{" "}
            <span className="text-sting tabular">→ 12</span>
            {"\n"}
            <span className="text-faint">│ │ └─</span>{" "}
            <span className="text-honey-soft">◆</span> visual · bottle vs can{" "}
            <span className="text-sting tabular">→ 2</span>
            {"\n"}
            <span className="text-faint">│ └─</span>{" "}
            <span className="text-honey-soft">◆</span> audio · ASMR can crack{" "}
            <span className="text-faint tabular">→ 0</span>
            {"\n"}
            <span className="text-faint">└─</span>{" "}
            <span className="text-honey-soft">◆</span> hook · &ldquo;move over,
            big soda&rdquo; <span className="text-sting tabular">→ 28</span>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}

/** Hex-shaped node sitting on the connector wire. */
function HexNode({ label }: { label: string }) {
  return (
    <div className="relative h-[72px] w-[64px]">
      <svg
        viewBox="0 0 64 72"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <path
          d="M32 2 L60 18 L60 54 L32 70 L4 54 L4 18 Z"
          fill="var(--ink-2)"
          stroke="var(--honey)"
          strokeWidth="1.5"
        />
        <path
          d="M32 12 L51 22 L51 50 L32 60 L13 50 L13 22 Z"
          fill="none"
          stroke="var(--honey)"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
      </svg>
      <span className="relative z-10 flex h-full items-center justify-center font-mono text-sm font-semibold text-honey">
        {label}
      </span>
    </div>
  );
}
