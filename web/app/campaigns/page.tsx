import Link from "next/link";
import { Filter } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { apiFetch } from "@/lib/api/client";
import { adaptCampaign } from "@/lib/api/adapters";
import type { ApiCampaignSummary, ApiPaginated } from "@/lib/api/types";

export const metadata = {
  title: "Campaigns · Hivework",
};

export default async function CampaignsPage() {
  // Server-side fetch — fresh on every request, no client flicker.
  let campaigns: ReturnType<typeof adaptCampaign>[] = [];
  try {
    const data = await apiFetch<ApiPaginated<ApiCampaignSummary>>(
      "/campaigns/active?limit=50"
    );
    campaigns = data.items.map(adaptCampaign);
  } catch {
    // api unreachable during local dev / build — render empty grid.
    campaigns = [];
  }

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
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </AppShell>
  );
}
