"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowRight } from "lucide-react";
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
import type { CampaignSummary } from "@/lib/mocks/campaigns";

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const { publicKey } = useWallet();
  const isMine = publicKey?.toBase58() === campaign.creatorWallet;
  const progress = Math.round((campaign.spentUsdc / campaign.poolUsdc) * 100);

  return (
    <Card className="flex h-full flex-col transition-colors hover:border-honey/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{campaign.brand}</CardTitle>
            <CardDescription>@{campaign.brandHandle}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isMine && <Badge variant="honey">yours</Badge>}
            <Badge variant="live">live</Badge>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">{campaign.product}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-wider text-muted">
          <span>
            ${campaign.spentUsdc} / ${campaign.poolUsdc} pool
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
          {campaign.nodes} ideas · {campaign.leaves} posts ·{" "}
          <span className="text-sting">{campaign.conversions} sales</span>
        </span>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/c/${campaign.id}`}>
            View campaign
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
