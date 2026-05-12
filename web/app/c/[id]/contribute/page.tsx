"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { postNodeDraft, postNodeFinalize, useCampaign } from "@/lib/api/hooks";
import { adaptCampaign, adaptTree } from "@/lib/api/adapters";
import { useHiveworkProgram } from "@/lib/anchor/program";
import { createNodeOnchain } from "@/lib/anchor/tx";
import { STAKE_SOL_BY_LEVEL } from "@/lib/anchor/stakes";

// Display values for the form. Single source of truth in @/lib/anchor/stakes.
const STAKE_BY_LEVEL: Record<number, number> = STAKE_SOL_BY_LEVEL;

const nodeSchema = z.object({
  level: z.coerce.number().min(1).max(3),
  parentId: z.string().min(1, "Pick a parent node"),
  title: z.string().min(4, "Title is required"),
  description: z.string().min(10, "Add a real description"),
});

type NodeForm = z.infer<typeof nodeSchema>;

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Add a marketing decision (a node) to a campaign tree.
 *
 * Note — leaf publishing was previously a tab here, but that flow lives
 * exclusively in `/c/[id]` (the Publish tab) now. Leaves are inherently
 * visual: you pick a path on the tree, you get a QR + ref-link instantly.
 * A form for it was redundant and confusing.
 */
export default function ContributePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: detail } = useCampaign(id);
  const campaign = detail ? adaptCampaign(detail.campaign) : undefined;
  const tree = detail ? adaptTree(detail) : [];

  const program = useHiveworkProgram();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);

  const form = useForm<NodeForm>({
    resolver: zodResolver(nodeSchema),
    defaultValues: { level: 1, parentId: "root", title: "", description: "" },
  });

  const watchedLevel = form.watch("level");
  const stakeForNode = STAKE_BY_LEVEL[watchedLevel] ?? STAKE_BY_LEVEL[1];

  async function submit(values: NodeForm) {
    if (!program || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    const campaignPdaStr = detail?.campaign.onchainPda;
    if (!campaignPdaStr) {
      toast.error(
        "Campaign isn't finalized on-chain yet — wait for the brand's tx to confirm."
      );
      return;
    }

    // Resolve parent on-chain PDA. L1 has no parent (passes SystemProgram
    // sentinel inside createNodeOnchain). L2/L3 require an already-finalized
    // parent node from the visible tree.
    let parentNode: PublicKey | null = null;
    if (values.level > 1) {
      const parent = tree.find((n) => n.id === values.parentId);
      if (!parent?.onchainPda) {
        toast.error(
          "Parent node isn't finalized on-chain yet. Pick a confirmed parent."
        );
        return;
      }
      parentNode = new PublicKey(parent.onchainPda);
    }

    setSubmitting(true);
    try {
      // 1) Persist the metadata draft.
      const draft = await postNodeDraft({
        campaignId: id,
        level: values.level === 1 ? "L1" : values.level === 2 ? "L2" : "L3",
        parentNodeId: values.level === 1 ? null : values.parentId,
        creatorWallet: publicKey.toBase58(),
        title: values.title,
        description: values.description,
        stakeSol: stakeForNode,
      });

      // 2) Sign + send create_node on-chain. The metadata payload here MUST
      //    match what we passed to /nodes/draft so the on-chain hash + the
      //    api row describe the same thing.
      const { nodePda, signature } = await createNodeOnchain(program, {
        campaign: new PublicKey(campaignPdaStr),
        creator: publicKey,
        level: values.level as 1 | 2 | 3,
        parentNode,
        metadata: { title: values.title, description: values.description },
        metadataCuid: draft.id,
      });
      toast.success(`Node staked ${stakeForNode} SOL on devnet`, {
        description: `tx ${signature.slice(0, 8)}…${signature.slice(-4)}`,
      });

      // 3) Finalize the off-chain row.
      await postNodeFinalize({
        draftId: draft.id,
        onchainPda: nodePda.toBase58(),
      });

      queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
      router.push(`/c/${id}`);
    } catch (err) {
      console.error("createNode failed", err);
      toast.error("Couldn't create node", {
        description:
          err instanceof Error ? err.message : "Unknown error — see console.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/c/${id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface/60 px-3 text-[13px] font-medium text-fg-soft transition-colors hover:border-honey/40 hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {campaign?.brand ?? "campaign"}
        </Link>

        <header className="mt-3 flex flex-col gap-2 border-b border-line pb-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-honey">
            add node
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            New marketing decision
          </h1>
          <p className="text-sm text-fg-soft">
            Add a hook, an audio choice, or a visual idea to the tree. Stakes
            unlock back to you when the node (or any descendant) generates at
            least one conversion.
          </p>
        </header>

        {/* Pointer to the publish flow — replaces the old leaf tab. */}
        <Link
          href={`/c/${id}`}
          className="mt-4 flex items-center justify-between gap-3 rounded-md border border-honey/30 bg-honey/[0.04] px-4 py-3 transition-colors hover:border-honey/50 hover:bg-honey/[0.07]"
        >
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5 text-honey" />
              Want to publish a post instead?
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              Pick a path visually on the tree, get a QR + ref-link instantly.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-honey" />
        </Link>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Node details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(submit)}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="level">Level</Label>
                  <select
                    id="level"
                    className="h-9 rounded-md border border-line bg-ink-2 px-3 text-sm"
                    {...form.register("level")}
                  >
                    <option value={1}>1 · Hook (0.01 SOL)</option>
                    <option value={2}>2 · Audio (0.005 SOL)</option>
                    <option value={3}>3 · Visual (0.0025 SOL)</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parentId">Parent node</Label>
                  <select
                    id="parentId"
                    className="h-9 rounded-md border border-line bg-ink-2 px-3 text-sm"
                    {...form.register("parentId")}
                  >
                    <option value="root">root · campaign</option>
                    {tree
                      .filter(
                        (n) => n.level === ((watchedLevel - 1) as 1 | 2 | 3)
                      )
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nodeTitle">Decision title</Label>
                <Input
                  id="nodeTitle"
                  placeholder='e.g. "Hook in aymara, emotional first sip"'
                  {...form.register("title")}
                />
                {form.formState.errors.title && (
                  <p className="font-mono text-[11px] text-sting">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nodeDesc">Description</Label>
                <Textarea
                  id="nodeDesc"
                  placeholder="Describe the decision in detail. Examples, references, prompts that worked for you. The richer the metadata, the higher the richness_score in the payout formula."
                  maxLength={500}
                  rows={4}
                  {...form.register("description")}
                />
                {form.formState.errors.description && (
                  <p className="font-mono text-[11px] text-sting">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="rounded-md border border-honey/30 bg-honey/5 p-3 font-mono text-[11px] leading-relaxed text-honey">
                Phantom will sign 1 tx: createNode + transfer {stakeForNode} SOL
                to the campaign&apos;s stake vault. Stake unlocks if your node
                (or any descendant) generates at least 1 conversion.
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting
                  ? "Signing…"
                  : `Stake ${stakeForNode} SOL & create node`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
