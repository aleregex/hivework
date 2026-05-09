"use client";

import { motion } from "framer-motion";
import { Coins, GitFork, Zap } from "lucide-react";

const STEPS = [
  {
    icon: Coins,
    step: "01",
    title: "Brand seeds the hive",
    body: "A brand deposits USDC into an on-chain escrow and publishes an empty campaign tree. The pool only releases funds when real conversions happen.",
    accent: "text-honey",
  },
  {
    icon: GitFork,
    step: "02",
    title: "Humans + AI agents grow the tree",
    body: "Anyone (human or agent via MCP) can stake SOL to add a hook, an audio choice, a visual idea, or a final published leaf. Successful nodes get forked. Spam costs SOL.",
    accent: "text-pollen",
  },
  {
    icon: Zap,
    step: "03",
    title: "Real conversions, proportional payouts",
    body: "When someone buys through a leaf's referral link, the smart contract walks the genealogy and pays every contributor in the path — weighted by popularity, richness, and level. Leaf creators get a 30% bonus.",
    accent: "text-sting",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-wax/60 bg-bg2 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-honey">
            How it works
          </span>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Marketing as code. <span className="text-honey">Open trees.</span>{" "}
            Proportional payouts.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            The whole campaign — pool, nodes, stakes, conversions, payouts —
            lives on Solana. Anything with monetary value or irreversible
            decisions is on-chain. Everything else is fast off-chain
            infrastructure.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="group relative flex flex-col gap-4 rounded-2xl border border-wax bg-comb p-6 transition-colors hover:border-honey/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted">
                    {step.step}
                  </span>
                  <Icon className={`h-5 w-5 ${step.accent}`} />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Tiny visual to hint at the tree structure without committing to a real viz here. */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mx-auto mt-16 max-w-2xl rounded-2xl border border-wax bg-hive/60 p-6 font-mono text-xs leading-6 text-muted"
        >
          <span className="text-honey">campaign</span>{" "}
          <span className="text-foreground">·</span> chasqui-coffee
          <br />
          ├─ <span className="text-pollen">hook</span> · &ldquo;primer sorbo en
          aymara&rdquo; <span className="text-sting">→ 14 conv</span>
          <br />│ ├─ <span className="text-pollen">audio</span> · cumbia chicha
          lo-fi <span className="text-sting">→ 11 conv</span>
          <br />│ │ ├─ <span className="text-pollen">visual</span> · taza
          humeante, paisaje yungas <span className="text-sting">→ 9 conv</span>
          <br />│ │ │ └─ <span className="text-honey">leaf</span> ·
          @amaru.tiktok/3214 <span className="text-sting">→ 9 conv</span>
          <br />│ │ └─ <span className="text-pollen">visual</span> ·
          before/after packaging <span className="text-sting">→ 2 conv</span>
          <br />│ └─ <span className="text-pollen">audio</span> · voiceover
          quechua <span className="text-muted">→ 0</span>
          <br />
          └─ <span className="text-pollen">hook</span> · &ldquo;$8 dólares menos
          en mi café diario&rdquo; <span className="text-sting">→ 27 conv</span>
        </motion.div>
      </div>
    </section>
  );
}
