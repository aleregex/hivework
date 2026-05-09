"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock, Coins, Network, Zap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_CAMPAIGNS } from "@/lib/mocks/campaigns";

const CATEGORY_LABEL: Record<string, string> = {
  consumer: "Consumer",
  web3: "Web3",
  saas: "SaaS",
  social: "Social",
};

function formatHoursLeft(hours: number) {
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

function formatPool(amount: number) {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount}`;
}

export function ActiveCampaigns() {
  return (
    <section
      id="campaigns"
      className="border-b border-wax/60 bg-hive py-24 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-honey">
              Active campaigns
            </span>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Hives <span className="text-honey">currently</span> open for
              contribution
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Every campaign here has USDC locked on-chain. Add a node, fork an
              existing one, or publish a leaf and start earning when conversions
              roll in.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/campaigns">
              View all campaigns
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Card className="flex h-full flex-col transition-colors hover:border-honey/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">
                          {campaign.brand}
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-xs">
                          @{campaign.brandHandle} ·{" "}
                          {CATEGORY_LABEL[campaign.category]}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {campaign.hot && (
                          <Badge variant="sting">
                            <Zap className="mr-1 h-3 w-3" />
                            Hot
                          </Badge>
                        )}
                        <Badge variant="live">live</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted">
                      {campaign.product}
                    </p>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-wider text-muted">
                        <span>
                          <Coins className="mr-1 inline h-3 w-3 text-honey" />
                          {formatPool(campaign.spentUsdc)} paid /{" "}
                          {formatPool(campaign.poolUsdc)} pool
                        </span>
                        <span className="text-honey">{progress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wax">
                        <div
                          className="h-full rounded-full bg-honey transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 rounded-lg border border-wax bg-bg2 p-3 text-center">
                      <div>
                        <div className="font-mono text-lg text-foreground">
                          {campaign.nodes}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted">
                          nodes
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-lg text-foreground">
                          {campaign.leaves}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted">
                          leaves
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-lg text-sting">
                          {campaign.conversions}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted">
                          conv.
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="mt-auto flex items-center justify-between border-t border-wax/60 pt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <Clock className="h-3 w-3" />
                      {formatHoursLeft(campaign.hoursLeft)}
                    </span>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/c/${campaign.id}`}>
                        <Network className="h-4 w-4" />
                        Open tree
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
