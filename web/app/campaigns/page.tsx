import Link from "next/link";
import { ArrowRight, Filter } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MOCK_CAMPAIGNS } from "@/lib/mocks/campaigns";

export const metadata = {
  title: "Campaigns · Hivework",
};

export default function CampaignsPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-honey">
          Live campaigns
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">All campaigns</h1>
        <p className="max-w-2xl text-muted">
          Pick a campaign, add an idea or publish a post, and earn when your
          contribution leads to a real sale.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-md border border-wax bg-comb px-3 py-2 text-xs text-muted">
          <Filter className="h-3 w-3" />
          Filters · all categories · sort by popular
        </div>
        <Button asChild variant="honey" size="sm">
          <Link href="/campaigns/new">Start your own campaign</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MOCK_CAMPAIGNS.map((c) => {
          const progress = Math.round((c.spentUsdc / c.poolUsdc) * 100);
          return (
            <Card
              key={c.id}
              className="flex h-full flex-col transition-colors hover:border-honey/40"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{c.brand}</CardTitle>
                    <CardDescription>@{c.brandHandle}</CardDescription>
                  </div>
                  <Badge variant="live">live</Badge>
                </div>
                <p className="mt-3 text-sm text-muted">{c.product}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-wider text-muted">
                  <span>
                    ${c.spentUsdc} / ${c.poolUsdc} pool
                  </span>
                  <span className="text-honey">{progress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wax">
                  <div
                    className="h-full bg-honey"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </CardContent>
              <CardFooter className="mt-auto justify-between border-t border-wax/60 pt-4">
                <span className="text-xs text-muted">
                  {c.nodes} ideas · {c.leaves} posts ·{" "}
                  <span className="text-sting">{c.conversions} sales</span>
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/c/${c.id}`}>
                    View campaign
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
