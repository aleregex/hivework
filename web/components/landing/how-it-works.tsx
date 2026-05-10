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
    body: "Anyone — a creator, a brand-side strategist, an MCP-driven AI agent — stakes SOL to add a hook, an audio choice, a visual idea, or a published post. Spam costs SOL. Good ideas get forked.",
    code: [
      "stake_node(",
      "  parent: 'h2',",
      "  level: 2,",
      "  stake: 0.005 SOL",
      ")",
    ],
  },
  {
    id: "03",
    title: "Conversions trigger payouts",
    body: "On every sale the contract walks the genealogy and pays everyone in the path — weighted by popularity, richness, and level. Post creator gets +30%. Platform takes 5%.",
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
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <SectionLabel id="§1">how the protocol works</SectionLabel>
          <h2 className="text-balance text-4xl leading-[1.1] sm:text-5xl">
            Marketing as code.
            <br />
            <span className="italic text-honey">Open trees.</span> Proportional
            payouts.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-fg-soft">
            Anything with monetary value or irreversible decisions lives
            on-chain. Everything else — metadata, indexer, short-links — runs
            off-chain so the hive stays fast and cheap.
          </p>
        </div>

        {/* Three step cards. Equal-height grid (items-stretch on the grid +
         * h-full on each card) plus a flex-col card with mt-auto on the code
         * block keeps the bottoms aligned even when bodies differ. */}
        <div className="mt-16 grid items-stretch gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="group relative flex h-full flex-col gap-5 rounded-xl border border-line bg-surface p-6 transition-colors hover:border-honey/40"
            >
              {/* Step marker — lives INSIDE the card, top-left. No floating
               * hex over a wire (that was the source of the visual break). */}
              <div className="flex items-center justify-between">
                <span className="inline-flex h-7 items-center gap-2 rounded-full border border-line bg-ink-2 pl-1 pr-3 font-mono text-[11px] tabular text-muted">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-honey text-[10px] font-semibold text-ink">
                    {step.id}
                  </span>
                  step
                </span>
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rotate-45 bg-honey/60"
                />
              </div>

              <h3 className="text-xl leading-snug">{step.title}</h3>
              <p className="text-[15px] leading-relaxed text-fg-soft">
                {step.body}
              </p>

              <pre className="mt-auto overflow-x-auto rounded-md border border-line bg-ink-2 px-3 py-2.5 font-mono text-[11px] leading-5 text-muted">
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
            </motion.div>
          ))}
        </div>

        {/* ASCII tree — the literal node graph. Made into the centerpiece. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-20 max-w-3xl overflow-hidden rounded-xl border border-line bg-ink"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            <span>
              <span className="text-honey">tree</span> · halo-cola · live
            </span>
            <span className="hidden tabular sm:inline">
              8 nodes · 3 posts · 47 conversions
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
            <span className="text-foreground">post</span> · @sofia.creates/tt{" "}
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
