"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATS = [
  { label: "USDC locked", value: "6,742", unit: "$" },
  { label: "Live campaigns", value: "03", unit: "#" },
  { label: "Ideas added", value: "121", unit: "#" },
  { label: "Sales paid out", value: "446", unit: "✓" },
];

export function Hero() {
  return (
    <section className="bg-hex-grid relative overflow-hidden border-b border-line">
      {/* Soft honey wash behind the headline. Single color, no rainbow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-honey/[0.08] blur-[140px]"
      />
      {/* Top + bottom fade so the hex grid doesn't fight the cards below. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink"
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 py-28 text-center sm:py-36">
        {/* Status pill — looks like a system tag, not a marketing badge */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 font-mono text-[11px] tracking-wider text-muted backdrop-blur"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
          </span>
          <span className="text-foreground">live</span>
          <span className="text-faint">·</span>
          <span>solana devnet</span>
          <span className="text-faint">·</span>
          <span>v0.1.0</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="font-display text-balance text-[44px] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-7xl"
        >
          Marketing is <span className="italic">teamwork.</span>
          <br />
          <span className="text-honey italic">Pay only for the honey.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-2xl text-balance text-base leading-relaxed text-fg-soft sm:text-lg"
        >
          A protocol for collaborative marketing on Solana. Brands lock USDC.
          Anyone — people or AI agents —{" "}
          <span className="text-foreground">adds ideas and posts</span>. When a
          real sale happens, the protocol{" "}
          <span className="text-honey">pays everyone who helped get there</span>
          .
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg" variant="honey">
            <Link href="/campaigns/new">
              Start a campaign
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#campaigns">See live campaigns</Link>
          </Button>
        </motion.div>

        {/* Stats strip — looks like a system status bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 grid w-full max-w-3xl grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface/60 backdrop-blur sm:grid-cols-4"
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`relative flex flex-col items-start gap-1 px-5 py-4 ${
                i > 0 ? "border-t border-line sm:border-l sm:border-t-0" : ""
              }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {stat.label}
              </span>
              <span className="font-mono text-2xl font-semibold tabular text-foreground">
                <span className="text-honey">{stat.unit}</span>
                {stat.value}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
