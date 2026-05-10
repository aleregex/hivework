"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  brand: z.string().min(2, "Brand name is required"),
  product: z.string().min(4, "Product description is required"),
  storefrontUrl: z.string().url("Must be a valid URL"),
  poolUsdc: z.coerce.number().min(50, "Minimum pool is 50 USDC"),
  conversionValueUsdc: z.coerce
    .number()
    .min(0.5, "Minimum 0.5 USDC per conversion"),
  deadlineDays: z.coerce.number().min(1).max(60),
  conversionCriteria: z.enum([
    "purchase",
    "signup",
    "mint",
    "subscription",
    "donation",
  ]),
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  "Brand & product",
  "Pool & deadline",
  "Conversion",
  "Review & sign",
] as const;

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brand: "",
      product: "",
      storefrontUrl: "",
      poolUsdc: 500,
      conversionValueUsdc: 2.5,
      deadlineDays: 14,
      conversionCriteria: "purchase",
    },
    mode: "onChange",
  });

  const values = watch();

  async function nextStep() {
    const fields: (keyof FormValues)[][] = [
      ["brand", "product", "storefrontUrl"],
      ["poolUsdc", "deadlineDays"],
      ["conversionCriteria", "conversionValueUsdc"],
      [],
    ];
    const ok = await trigger(fields[step]);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit() {
    // TODO(group-c, task #6): replace with Anchor createCampaign tx + USDC escrow transfer.
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    toast.success("Campaign created on devnet (mock)", {
      description:
        "USDC moved to escrow. Tree is empty — share the link to start.",
    });
    router.push("/c/cmp_halo_cola");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 text-xs text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to campaigns
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Launch a campaign
        </h1>
        <p className="mt-2 text-sm text-muted">
          Deposit USDC into escrow and publish an empty tree. You only pay when
          real conversions happen.
        </p>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i < step
                    ? "bg-honey text-hive"
                    : i === step
                      ? "bg-honey/20 text-honey ring-1 ring-honey"
                      : "bg-wax text-muted"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 ${i < step ? "bg-honey" : "bg-wax"}`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{STEPS[step]}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              {step === 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="brand">Brand name</Label>
                    <Input
                      id="brand"
                      placeholder="Chasqui Coffee"
                      {...register("brand")}
                    />
                    {errors.brand && (
                      <p className="text-xs text-sting">
                        {errors.brand.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product">Product description</Label>
                    <Textarea
                      id="product"
                      placeholder="Single-origin Yungas espresso · 250g bag · ships LATAM-wide"
                      {...register("product")}
                    />
                    {errors.product && (
                      <p className="text-xs text-sting">
                        {errors.product.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="storefrontUrl">Storefront URL</Label>
                    <Input
                      id="storefrontUrl"
                      placeholder="https://shop.halocola.com"
                      {...register("storefrontUrl")}
                    />
                    {errors.storefrontUrl && (
                      <p className="text-xs text-sting">
                        {errors.storefrontUrl.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="poolUsdc">Pool size (USDC)</Label>
                    <Input
                      id="poolUsdc"
                      type="number"
                      step="50"
                      {...register("poolUsdc")}
                    />
                    <p className="text-xs text-muted">
                      Minimum $50. This goes into on-chain escrow at signing
                      time.
                    </p>
                    {errors.poolUsdc && (
                      <p className="text-xs text-sting">
                        {errors.poolUsdc.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deadlineDays">Deadline (days)</Label>
                    <Input
                      id="deadlineDays"
                      type="number"
                      min={1}
                      max={60}
                      {...register("deadlineDays")}
                    />
                    {errors.deadlineDays && (
                      <p className="text-xs text-sting">
                        {errors.deadlineDays.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="conversionCriteria">
                      What counts as a conversion?
                    </Label>
                    <select
                      id="conversionCriteria"
                      className="h-10 rounded-md border border-wax bg-bg2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey/40"
                      {...register("conversionCriteria")}
                    >
                      <option value="purchase">Purchase completed</option>
                      <option value="signup">Signup with verified email</option>
                      <option value="mint">NFT mint on-chain</option>
                      <option value="subscription">
                        First-month subscription
                      </option>
                      <option value="donation">Donation transfer</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="conversionValueUsdc">
                      Payout per conversion (USDC)
                    </Label>
                    <Input
                      id="conversionValueUsdc"
                      type="number"
                      step="0.5"
                      {...register("conversionValueUsdc")}
                    />
                    <p className="text-xs text-muted">
                      This is what&apos;s distributed across all nodes in the
                      path that led to the sale (minus 5% platform fee).
                    </p>
                    {errors.conversionValueUsdc && (
                      <p className="text-xs text-sting">
                        {errors.conversionValueUsdc.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-3 rounded-md border border-wax bg-bg2 p-4 text-sm">
                  <Row label="Brand" value={values.brand} />
                  <Row label="Product" value={values.product} />
                  <Row label="Storefront" value={values.storefrontUrl} />
                  <Row label="Pool" value={`$${values.poolUsdc} USDC`} />
                  <Row label="Deadline" value={`${values.deadlineDays} days`} />
                  <Row
                    label="Conversion criteria"
                    value={values.conversionCriteria}
                  />
                  <Row
                    label="Per-conversion payout"
                    value={`$${values.conversionValueUsdc} USDC`}
                  />
                  <div className="mt-2 rounded border border-honey/30 bg-honey/5 p-3 text-xs text-honey">
                    Phantom will ask you to sign 1 transaction: create campaign
                    PDA + transfer ${values.poolUsdc} USDC to escrow.
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button type="button" size="sm" onClick={nextStep}>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Signing…" : "Sign & deposit"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}
