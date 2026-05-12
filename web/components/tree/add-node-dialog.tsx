"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NodeLevel, TreeNode } from "@/lib/mocks/tree";
import { useHiveworkProgram } from "@/lib/anchor/program";
import { createNodeOnchain } from "@/lib/anchor/tx";
import { postNodeDraft, postNodeFinalize } from "@/lib/api/hooks";

/**
 * Inline node-creation modal. Replaces the full-page /contribute flow for
 * the in-tree workflow: user selects a node on the canvas, hits "+ Add child
 * here", a modal opens with parent + level prefilled, fills title/desc, signs
 * (mocked) — and the new node materializes in the tree without a navigation.
 *
 * Scope: this dialog handles L1/L2/L3 only. Creating an L4 ("post") is the
 * Publish tab's job — see PublishFlowPanel — because posts come with a
 * ref-link + QR and that UX is visual, not form-based.
 */

// Stakes match Contract/programs/hivework/src/constants.rs after the
// devnet-cheap redeploy. Display only — contract enforces the on-chain values.
const STAKE_BY_LEVEL: Record<1 | 2 | 3, number> = {
  1: 0.01,
  2: 0.005,
  3: 0.0025,
};

const LEVEL_LABEL: Record<1 | 2 | 3, string> = {
  1: "Hook (the first 3 seconds)",
  2: "Audio choice",
  3: "Visual / key moment",
};

const schema = z.object({
  title: z.string().min(4, "Title needs at least 4 characters"),
  description: z.string().min(10, "Add a real description"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  /** The parent under which the new child will be created. null = create at root (L1). */
  parent: TreeNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the freshly-built TreeNode so the caller can splice it into local state. */
  onCreate: (node: TreeNode) => void;
  /** Called when the parent is L3 — caller should switch to Publish flow with the path locked up to L3. */
  onSwitchToPublish?: (parentL3: TreeNode) => void;
  /** Wallet handle for the author of the new node. Defaults to "you". */
  authorHandle?: string;
  /** Off-chain campaign id (CUID). Required to call the api drafts. */
  campaignId: string;
  /** On-chain campaign PDA. Null while the campaign is still in `draft`. */
  campaignOnchainPda: string | null;
};

export function AddNodeDialog({
  parent,
  open,
  onOpenChange,
  onCreate,
  onSwitchToPublish,
  authorHandle = "you",
  campaignId,
  campaignOnchainPda,
}: Props) {
  const program = useHiveworkProgram();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  // Determine the level of the new child. Falls back to L1 when parent is null
  // (top-level hook). Capped at 4 — L4 is delegated to the publish flow.
  const childLevel: NodeLevel = parent
    ? (Math.min(parent.level + 1, 4) as NodeLevel)
    : 1;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "" },
  });

  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever the dialog opens with a new parent.
  useEffect(() => {
    if (open) form.reset({ title: "", description: "" });
  }, [open, parent, form]);

  // L3 parent → caller wants to publish a post, not add a node. Surface the
  // detour cleanly so the user understands why we're switching tabs.
  if (childLevel === 4) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publishing a post, not a node</DialogTitle>
            <DialogDescription>
              Children of an L3 visual are{" "}
              <span className="text-honey">posts</span> — published content with
              a ref-link + QR. That flow is on the tree itself: switch to the
              Publish tab and we&apos;ll pre-lock the path up to this visual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="honey"
              onClick={() => {
                if (parent) onSwitchToPublish?.(parent);
                onOpenChange(false);
              }}
            >
              <Sparkles className="h-4 w-4" />
              Open publish flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // L1/L2/L3 child — actual node creation form.
  const stake = STAKE_BY_LEVEL[childLevel as 1 | 2 | 3];
  const levelLabel = LEVEL_LABEL[childLevel as 1 | 2 | 3];

  const submit = async (values: FormValues) => {
    if (!program || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!campaignOnchainPda) {
      toast.error(
        "Campaign isn't finalized on-chain yet — wait for the brand's tx."
      );
      return;
    }
    // L2/L3 require an already-finalized parent.
    let parentNode: PublicKey | null = null;
    if (childLevel > 1) {
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
      const title = values.title.trim();
      const description = values.description.trim();

      // 1) Persist the draft. Returns the CUID we'll use as the new node's id.
      const draft = await postNodeDraft({
        campaignId,
        level:
          childLevel === 1 ? "L1" : childLevel === 2 ? "L2" : "L3",
        parentNodeId: childLevel === 1 ? null : (parent?.id ?? null),
        creatorWallet: publicKey.toBase58(),
        title,
        description,
        stakeSol: stake,
      });

      // 2) Sign + send create_node. Metadata MUST match the api row so the
      //    on-chain hash + the off-chain blob describe the same thing.
      const { nodePda, signature } = await createNodeOnchain(program, {
        campaign: new PublicKey(campaignOnchainPda),
        creator: publicKey,
        level: childLevel as 1 | 2 | 3,
        parentNode,
        metadata: { title, description },
        metadataCuid: draft.id,
      });

      // 3) Finalize the api row with the resolved PDA.
      await postNodeFinalize({
        draftId: draft.id,
        onchainPda: nodePda.toBase58(),
      });

      // 4) Splice into local tree state via the existing onCreate callback.
      const newNode: TreeNode = {
        id: draft.id,
        level: childLevel,
        parentId: parent ? parent.id : "root",
        title,
        description,
        author: "human",
        authorHandle,
        stakeSol: stake,
        forks: 0,
        conversions: 0,
        payoutUsdc: 0,
        onchainPda: nodePda.toBase58(),
      };
      onCreate(newNode);
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      toast.success(`Node staked ${stake} SOL on devnet`, {
        description: `tx ${signature.slice(0, 8)}…${signature.slice(-4)}`,
        duration: 2400,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("createNode failed", err);
      toast.error("Couldn't create node", {
        description:
          err instanceof Error ? err.message : "Unknown error — see console.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-honey">
            new L{childLevel} · {levelLabel}
          </p>
          <DialogTitle>
            {parent
              ? `Add a ${childLevel === 2 ? "audio" : childLevel === 3 ? "visual" : "hook"} under "${truncate(parent.title, 40)}"`
              : "Add a top-level hook"}
          </DialogTitle>
          <DialogDescription>
            Stake unlocks back to you when this node — or any descendant —
            generates at least 1 conversion.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-4"
        >
          {/* Parent context strip — read-only, shows where this attaches */}
          <div className="rounded-md border border-line bg-ink-2/50 px-3 py-2.5 font-mono text-[11px] leading-relaxed">
            <span className="text-faint">parent ›</span>{" "}
            {parent ? (
              <>
                <span className="text-muted">L{parent.level}</span>{" "}
                <span className="text-foreground">{parent.title}</span>
              </>
            ) : (
              <span className="text-foreground">root · campaign</span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-node-title">Decision title</Label>
            <Input
              id="add-node-title"
              autoFocus
              placeholder={
                childLevel === 1
                  ? 'e.g. "Hook in aymara, emotional first sip"'
                  : childLevel === 2
                    ? 'e.g. "Lo-fi beach instrumental"'
                    : 'e.g. "Slow-mo can crack, golden hour"'
              }
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="font-mono text-[11px] text-sting">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-node-desc">Description</Label>
            <Textarea
              id="add-node-desc"
              rows={4}
              maxLength={500}
              placeholder="Examples, references, prompts that worked. Richer metadata bumps your richness_score in the payout formula."
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="font-mono text-[11px] text-sting">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="rounded-md border border-honey/30 bg-honey/5 p-3 font-mono text-[11px] leading-relaxed text-honey">
            Phantom will sign 1 tx: createNode + transfer {stake} SOL to the
            campaign&apos;s stake vault.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="honey" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Signing…" : `Stake ${stake} SOL & create`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
