"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock, Network, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { MOCK_CAMPAIGNS } from "@/lib/mocks/campaigns";

const CATEGORY_LABEL: Record<string, string> = {
  consumer: "consumer",
  web3: "web3",
  saas: "saas",
  social: "social",
};

function formatHoursLeft(hours: number) {
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatPool(amount: number) {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return `${amount}`;
}

export function ActiveCampaigns() {
  return (
    <section id="campaigns" className="border-b border-line bg-ink py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-xl flex-col gap-4">
            <SectionLabel id="§2">active hives</SectionLabel>
            <h2 className="text-balance text-4xl font-semibold leading-tight tracking-[-0.02em] sm:text-5xl">
              Live campaigns.{" "}
              <span className="text-honey">Open for contribution.</span>
            </h2>
            <p className="text-base leading-relaxed text-fg-soft">
              Every hive listed below has USDC locked on devnet. Add a node,
              fork a hook, or publish a leaf — earn proportionally when
              conversions land.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/campaigns">
              View all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {MOCK_CAMPAIGNS.map((campaign, i) => {
            const progress = Math.round(
              (campaign.spentUsdc / campaign.poolUsdc) * 100
            );
            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group relative flex flex-col bg-surface transition-colors hover:bg-surface-2"
              >
                {/* Top status bar — looks like a window header */}
                <div className="flex items-center justify-between border-b border-line/60 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
                    </span>
                    live
                  </span>
                  <span>
                    {CATEGORY_LABEL[campaign.category]}{" "}
                    <span className="text-faint">·</span>{" "}
                    <span className="tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-5 p-5">
                  {/* Brand */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-semibold tracking-tight">
                          {campaign.brand}
                        </h3>
                        {campaign.hot && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sting/30 bg-sting/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sting">
                            <Zap className="h-2.5 w-2.5" />
                            hot
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        @{campaign.brandHandle}
                      </p>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-sm leading-relaxed text-fg-soft">
                    {campaign.product}
                  </p>

                  {/* Pool progress */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      <span>pool</span>
                      <span className="tabular text-fg-soft">
                        <span className="text-honey">
                          ${formatPool(campaign.spentUsdc)}
                        </span>
                        <span className="text-faint"> / </span>
                        ${formatPool(campaign.poolUsdc)}
                      </span>
                    </div>
                    <div className="relative h-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-honey"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 divide-x divide-line/60 rounded-md border border-line/60 bg-ink-2/40">
                    <Stat label="nodes" value={campaign.nodes} />
                    <Stat label="leaves" value={campaign.leaves} />
                    <Stat
                      label="conv"
                      value={campaign.conversions}
                      accent="sting"
                    />
                  </div>

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between border-t border-line/60 pt-4">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                      <Clock className="h-3 w-3" />
                      <span className="tabular">
                        {formatHoursLeft(campaign.hoursLeft)}
                      </span>{" "}
                      left
                    </span>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/c/${campaign.id}`}>
                        <Network className="h-4 w-4" />
                        Open tree
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "honey" | "sting";
}) {
  const color =
    accent === "sting"
      ? "text-sting"
      : accent === "honey"
        ? "text-honey"
        : "text-foreground";
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-3">
      <span className={`font-mono text-base font-semibold tabular ${color}`}>
        {value}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
    </div>
  );
}
