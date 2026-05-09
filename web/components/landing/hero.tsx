"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="bg-honeycomb relative overflow-hidden border-b border-wax/60">
      {/* Subtle radial highlight behind the headline. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-honey/10 blur-[120px]"
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-28 text-center sm:py-36">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-honey/30 bg-honey/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-honey"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Marketing-as-a-hive · live on Solana devnet
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-balance text-5xl font-semibold tracking-tight sm:text-7xl"
        >
          Marketing is teamwork.
          <br />
          <span className="text-honey">Pay only for the honey.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-2xl text-balance text-lg leading-relaxed text-muted"
        >
          Brands burn{" "}
          <span className="font-semibold text-foreground">$33B</span> a year on
          influencer marketing.{" "}
          <span className="font-semibold text-sting">67%</span> can&apos;t tell
          you which decision generated the sale. Hivework turns every campaign
          into an open tree of marketing decisions — and pays everyone whose
          contribution led to a real conversion.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-3 pt-4"
        >
          <Button asChild size="lg" variant="honey">
            <Link href="/campaigns/new">
              Launch a campaign
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#campaigns">Explore campaigns</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-wax/60 bg-wax/40 sm:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 bg-comb px-6 py-5"
            >
              <span className="font-mono text-2xl font-semibold text-honey">
                {stat.value}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const STATS = [
  { label: "USDC in escrow", value: "$6.7K" },
  { label: "Active campaigns", value: "3" },
  { label: "Nodes in trees", value: "121" },
  { label: "Conversions paid", value: "446" },
];
