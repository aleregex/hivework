import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
  const totalPosts = MOCK_TREE.filter((n) => n.level === 4).length;
  const totalConversions = MOCK_TREE.filter((n) => n.level === 4).reduce(
    (sum, n) => sum + n.conversions,
    0
  );
  const closesInDays = Math.floor(campaign.hoursLeft / 24);
  const closesInHours = campaign.hoursLeft % 24;

  return (
    <AppShell>
      {/* Back link — chip-style so it actually reads as a button */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/campaigns"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface/60 px-3 text-[13px] font-medium text-fg-soft transition-colors hover:border-honey/40 hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All campaigns
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          {campaign.id}
        </span>
      </div>

      {/* Hero — brand, badges, what's being promoted */}
      <header className="mt-4 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
        </div>
        <p className="text-sm text-fg-soft">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            promoting ›
          </span>{" "}
          <span className="text-foreground">{campaign.product}</span>
        </p>
      </header>

      {/* Stats strip — pool bar + secondary numbers, all on one tight row */}
      <section className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface/60 px-4 py-3">
        {/* Pool progress — left, takes the room */}
        <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <span>
              pool{" "}
              <span className="tabular text-honey">
                ${campaign.spentUsdc}
              </span>
              <span className="text-faint"> / </span>
              <span className="tabular text-foreground">
                ${campaign.poolUsdc}
              </span>
            </span>
            <span>
              <span className="tabular text-honey">{progress}%</span>
              <span className="text-faint"> · </span>
              <span className="tabular text-foreground">
                {closesInDays}d {closesInHours}h
              </span>{" "}
              left
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-honey"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Divider */}
        <span aria-hidden className="hidden h-8 w-px bg-line md:block" />

        {/* Secondary stats — denser, smaller */}
        <div className="flex items-center gap-x-5 gap-y-1">
          <Stat label="nodes" value={totalNodes} />
          <Stat label="posts" value={totalPosts} />
          <Stat label="conv" value={totalConversions} accent="sting" />
        </div>
      </section>

      {/* Tree */}
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
      <span className={`font-mono text-base font-bold tabular ${color}`}>
        {value}
      </span>
    </div>
  );
}
