"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MOCK_CAMPAIGNS } from "@/lib/mocks/campaigns";
import { getNodesByLevel } from "@/lib/mocks/tree";

const STAKE_BY_LEVEL: Record<number, number> = {
  1: 1.0,
  2: 0.5,
  3: 0.25,
  4: 0.1,
};

const nodeSchema = z.object({
  level: z.coerce.number().min(1).max(3),
  parentId: z.string().min(1, "Pick a parent node"),
  title: z.string().min(4, "Title is required"),
  description: z.string().min(10, "Add a real description"),
});

const leafSchema = z.object({
  hookId: z.string().min(1, "Pick a hook"),
  audioId: z.string().min(1, "Pick an audio"),
  visualId: z.string().min(1, "Pick a visual"),
  contentUrl: z.string().url("Must be a valid URL"),
});

type NodeForm = z.infer<typeof nodeSchema>;
type LeafForm = z.infer<typeof leafSchema>;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

export default function ContributePage({ params, searchParams }: PageProps) {
  const { id } = use(params);
  const { type } = use(searchParams);
  const initialTab = type === "leaf" ? "leaf" : "node";

  const router = useRouter();
  const campaign = MOCK_CAMPAIGNS.find((c) => c.id === id);

  const [submitting, setSubmitting] = useState(false);

  const nodeForm = useForm<NodeForm>({
    resolver: zodResolver(nodeSchema),
    defaultValues: { level: 1, parentId: "root", title: "", description: "" },
  });

  const leafForm = useForm<LeafForm>({
    resolver: zodResolver(leafSchema),
    defaultValues: { hookId: "", audioId: "", visualId: "", contentUrl: "" },
  });

  const watchedLevel = nodeForm.watch("level");
  const stakeForNode = STAKE_BY_LEVEL[watchedLevel] ?? 1.0;

  async function submitNode() {
    // TODO(group-c, task #6): replace with Anchor createNode tx + SOL stake transfer.
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitting(false);
    toast.success(`Node staked ${stakeForNode} SOL on devnet (mock)`);
    router.push(`/c/${id}`);
  }

  async function submitLeaf() {
    // TODO(group-c, task #6): replace with Anchor createLeaf tx + 0.1 SOL stake.
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitting(false);
    toast.success("Leaf published — ref code generated (mock)", {
      description: "Share hivework.link/ay7m9p in your social bio.",
    });
    router.push(`/c/${id}`);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/c/${id}`}
          className="inline-flex items-center gap-2 text-xs text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to {campaign?.brand ?? "campaign"}
        </Link>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Contribute to the hive
        </h1>
        <p className="mt-2 text-sm text-muted">
          Add a marketing decision (a node) or publish a piece of content with a
          unique referral link (a leaf).
        </p>

        <Tabs defaultValue={initialTab} className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="node" className="flex-1">
              Add a node
            </TabsTrigger>
            <TabsTrigger value="leaf" className="flex-1">
              Publish a leaf
            </TabsTrigger>
          </TabsList>

          {/* NODE TAB */}
          <TabsContent value="node">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  New marketing decision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={nodeForm.handleSubmit(submitNode)}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="level">Level</Label>
                      <select
                        id="level"
                        className="h-10 rounded-md border border-wax bg-bg2 px-3 text-sm"
                        {...nodeForm.register("level")}
                      >
                        <option value={1}>1 · Hook (1.0 SOL)</option>
                        <option value={2}>2 · Audio (0.5 SOL)</option>
                        <option value={3}>3 · Visual (0.25 SOL)</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="parentId">Parent node</Label>
                      <select
                        id="parentId"
                        className="h-10 rounded-md border border-wax bg-bg2 px-3 text-sm"
                        {...nodeForm.register("parentId")}
                      >
                        <option value="root">root · campaign</option>
                        {getNodesByLevel((watchedLevel - 1) as 1 | 2 | 3).map(
                          (n) => (
                            <option key={n.id} value={n.id}>
                              {n.title}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nodeTitle">Decision title</Label>
                    <Input
                      id="nodeTitle"
                      placeholder='e.g. "Hook in aymara, emotional first sip"'
                      {...nodeForm.register("title")}
                    />
                    {nodeForm.formState.errors.title && (
                      <p className="text-xs text-sting">
                        {nodeForm.formState.errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nodeDesc">
                      Description (max 500 chars)
                    </Label>
                    <Textarea
                      id="nodeDesc"
                      placeholder="Describe the decision in detail. Examples, references, prompts that worked for you. The richer the metadata, the higher the richness_score in the payout formula."
                      maxLength={500}
                      rows={4}
                      {...nodeForm.register("description")}
                    />
                    {nodeForm.formState.errors.description && (
                      <p className="text-xs text-sting">
                        {nodeForm.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="rounded-md border border-honey/30 bg-honey/5 p-3 text-xs text-honey">
                    Phantom will ask you to sign 1 transaction: createNode +
                    transfer {stakeForNode} SOL to the campaign&apos;s stake
                    vault. Stake unlocks if your node (or any descendant)
                    generates at least 1 conversion.
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
          </TabsContent>

          {/* LEAF TAB */}
          <TabsContent value="leaf">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Publish a leaf · unique ref-link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={leafForm.handleSubmit(submitLeaf)}
                  className="flex flex-col gap-4"
                >
                  <p className="text-xs text-muted">
                    Pick one decision from each level to compose the
                    genealogical path. The system generates a unique ref-link
                    you publish in your bio or video description.
                  </p>

                  <PathPicker
                    label="Hook"
                    register={leafForm.register("hookId")}
                    options={getNodesByLevel(1)}
                    error={leafForm.formState.errors.hookId?.message}
                  />
                  <PathPicker
                    label="Audio"
                    register={leafForm.register("audioId")}
                    options={getNodesByLevel(2)}
                    error={leafForm.formState.errors.audioId?.message}
                  />
                  <PathPicker
                    label="Visual"
                    register={leafForm.register("visualId")}
                    options={getNodesByLevel(3)}
                    error={leafForm.formState.errors.visualId?.message}
                  />

                  <div className="grid gap-2">
                    <Label htmlFor="contentUrl">Published content URL</Label>
                    <Input
                      id="contentUrl"
                      placeholder="https://www.tiktok.com/@you/video/123"
                      {...leafForm.register("contentUrl")}
                    />
                    <p className="text-xs text-muted">
                      Optional now, you can complete it after publishing. The
                      ref-link is generated immediately.
                    </p>
                    {leafForm.formState.errors.contentUrl && (
                      <p className="text-xs text-sting">
                        {leafForm.formState.errors.contentUrl.message}
                      </p>
                    )}
                  </div>

                  <div className="rounded-md border border-honey/30 bg-honey/5 p-3 text-xs text-honey">
                    Phantom will ask you to sign 1 transaction: createLeaf +
                    stake 0.1 SOL. You also get a +30% bonus on top of your base
                    payout for every conversion this leaf generates.
                  </div>

                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Sparkles className="h-4 w-4" />
                    {submitting ? "Signing…" : "Stake 0.1 SOL & publish leaf"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function PathPicker({
  label,
  register,
  options,
  error,
}: {
  label: string;
  register: UseFormRegisterReturn;
  options: ReturnType<typeof getNodesByLevel>;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <select
        className="h-10 rounded-md border border-wax bg-bg2 px-3 text-sm"
        {...register}
      >
        <option value="">Pick one…</option>
        {options.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title} ·{" "}
            {n.conversions > 0 ? `${n.conversions} conv` : "no conv yet"}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-sting">{error}</p>}
    </div>
  );
}
