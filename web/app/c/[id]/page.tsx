import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { TreeView } from "@/components/tree/tree-view";
import { MOCK_CAMPAIGNS } from "@/lib/mocks/campaigns";
import { MOCK_TREE } from "@/lib/mocks/tree";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const campaign = MOCK_CAMPAIGNS.find((c) => c.id === id);
  if (!campaign) notFound();

  const progress = Math.round((campaign.spentUsdc / campaign.poolUsdc) * 100);
  const totalNodes = MOCK_TREE.filter(
    (n) => n.level >= 1 && n.level <= 3
  ).length;
  const totalLeaves = MOCK_TREE.filter((n) => n.level === 4).length;
  const totalConversions = MOCK_TREE.filter((n) => n.level === 4).reduce(
    (sum, n) => sum + n.conversions,
    0
  );
  const closesInDays = Math.floor(campaign.hoursLeft / 24);
  const closesInHours = campaign.hoursLeft % 24;

  return (
    <AppShell>
      {/* Single-row breadcrumb + campaign id */}
      <div className="flex items-center gap-3 font-mono text-[11px]">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          campaigns
        </Link>
        <span className="text-faint">/</span>
        <span className="uppercase tracking-[0.18em] text-honey">
          {campaign.id}
        </span>
      </div>

      {/* Hero row — brand left, stats right, all on one line on desktop */}
      <header className="mt-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-line pb-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <h1 className="text-[28px] font-bold leading-none tracking-[-0.025em] sm:text-[32px]">
            {campaign.brand}
          </h1>
          <span className="font-mono text-[12px] text-muted">
            @{campaign.brandHandle}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-live/40 bg-live/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-live">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
            </span>
            live
          </span>
          {campaign.hot && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sting/40 bg-sting/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sting">
              <Zap className="h-2.5 w-2.5" />
              hot
            </span>
          )}
          <span className="basis-full text-sm text-fg-soft">
            {campaign.product}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Stat label="pool" value={`$${campaign.poolUsdc}`} accent="honey" />
          <Stat label="paid" value={`$${campaign.spentUsdc}`} />
          <Stat label="nodes" value={totalNodes} />
          <Stat label="leaves" value={totalLeaves} />
          <Stat label="conv" value={totalConversions} accent="sting" />
          <Button asChild variant="outline" size="sm" className="ml-1">
            <Link href={`/c/${campaign.id}/contribute`}>
              <Plus className="h-4 w-4" />
              Add node
            </Link>
          </Button>
        </div>
      </header>

      {/* Pool bar — one slim line */}
      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[11px]">
        <span className="uppercase tracking-[0.18em] text-muted">pool</span>
        <div className="relative h-1 min-w-[160px] flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-honey"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="tabular text-honey">{progress}%</span>
        <span className="text-faint">·</span>
        <span className="text-muted">
          closes in{" "}
          <span className="tabular text-foreground">
            {closesInDays}d {closesInHours}h
          </span>
        </span>
      </div>

      {/* Tree — straight to the canvas */}
      <div className="mt-4">
        <TreeView initialNodes={MOCK_TREE} campaignId={campaign.id} />
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "honey" | "sting";
}) {
  const color =
    accent === "honey"
      ? "text-honey"
      : accent === "sting"
        ? "text-sting"
        : "text-foreground";
  return (
    <div className="flex items-baseline gap-1.5 leading-none">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <span className={`font-mono text-lg font-bold tabular ${color}`}>
        {value}
      </span>
    </div>
  );
}
