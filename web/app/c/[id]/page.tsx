import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitFork, Network, Plus, Sparkles, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <AppShell>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-xs text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to campaigns
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {campaign.brand}
            </h1>
            <Badge variant="live">live</Badge>
            {campaign.hot && (
              <Badge variant="sting">
                <Zap className="mr-1 h-3 w-3" />
                Hot
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            @{campaign.brandHandle} · {campaign.product}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/c/${campaign.id}/contribute?type=node`}>
              <Plus className="h-4 w-4" />
              Add node
            </Link>
          </Button>
          <Button asChild variant="honey" size="sm">
            <Link href={`/c/${campaign.id}/contribute?type=leaf`}>
              <Sparkles className="h-4 w-4" />
              Publish leaf
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-wax bg-wax sm:grid-cols-5">
        <Stat
          label="Pool USDC"
          value={`$${campaign.poolUsdc}`}
          accent="honey"
        />
        <Stat
          label="Paid out"
          value={`$${campaign.spentUsdc}`}
          accent="honey"
        />
        <Stat label="Nodes" value={totalNodes} accent="default" />
        <Stat label="Leaves" value={totalLeaves} accent="default" />
        <Stat label="Conversions" value={totalConversions} accent="sting" />
      </div>

      {/* Pool progress */}
      <div className="mt-6 rounded-xl border border-wax bg-comb p-5">
        <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-wider text-muted">
          <span>Pool consumed</span>
          <span className="text-honey">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-wax">
          <div
            className="h-full rounded-full bg-honey transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Closes in {Math.floor(campaign.hoursLeft / 24)}d{" "}
          {campaign.hoursLeft % 24}h. After that the smart contract distributes
          the remaining pool proportionally to the genealogical paths that
          converted.
        </p>
      </div>

      {/* Tree placeholder — real viz lands in Task #5 */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Tree of decisions
          </h2>
          <Badge variant="outline">
            <GitFork className="mr-1 h-3 w-3" />
            {totalNodes + totalLeaves} elements
          </Badge>
        </div>

        <Card className="mt-3">
          <CardContent className="flex h-[460px] items-center justify-center text-center">
            <div className="flex max-w-md flex-col items-center gap-3">
              <Network className="h-10 w-10 text-honey" />
              <p className="text-sm font-medium">Interactive tree coming up</p>
              <p className="text-xs text-muted">
                react-force-graph visualization with realtime updates lands in
                Task #5. For now you can use the level breakdown below or jump
                straight to{" "}
                <Link
                  href={`/c/${campaign.id}/contribute`}
                  className="text-honey underline-offset-2 hover:underline"
                >
                  contribute
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Level breakdown — quick summary while the viz isn't built */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {LEVEL_LABELS.map((level) => {
            const nodesAtLevel = MOCK_TREE.filter((n) => n.level === level.id);
            return (
              <div
                key={level.id}
                className="rounded-lg border border-wax bg-comb p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted">
                    Level {level.id} · {level.label}
                  </span>
                  <span className={`font-mono text-xs ${level.color}`}>
                    {nodesAtLevel.length}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {nodesAtLevel.slice(0, 3).map((n) => (
                    <li
                      key={n.id}
                      className="truncate text-xs text-foreground"
                      title={n.title}
                    >
                      <span
                        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${level.color.replace("text-", "bg-")}`}
                      />
                      {n.title}
                    </li>
                  ))}
                  {nodesAtLevel.length === 0 && (
                    <li className="text-xs text-muted">empty — be the first</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
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
  accent: "honey" | "sting" | "default";
}) {
  const color =
    accent === "honey"
      ? "text-honey"
      : accent === "sting"
        ? "text-sting"
        : "text-foreground";
  return (
    <div className="flex flex-col items-center gap-1 bg-comb px-4 py-4">
      <span className={`font-mono text-xl font-semibold ${color}`}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
    </div>
  );
}

const LEVEL_LABELS = [
  { id: 1 as const, label: "Hooks", color: "text-pollen" },
  { id: 2 as const, label: "Audio", color: "text-honey" },
  { id: 3 as const, label: "Visual", color: "text-sting" },
  { id: 4 as const, label: "Leaves", color: "text-foreground" },
];
