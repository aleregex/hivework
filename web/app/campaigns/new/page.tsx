"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
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
    // onTouched: only show errors after the user has interacted with a field
    // (blur). Avoids the "all-fields-red on first paint" problem the previous
    // onChange mode caused when defaults were empty strings.
    mode: "onTouched",
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
          Start a campaign
        </h1>
        <p className="mt-2 text-sm text-muted">
          Deposit USDC into escrow and open it for contributions. You only pay
          when real sales happen.
        </p>

        {/* Step indicator — grid of 4 equal columns. Each column has the
         * circle + its label, perfectly centered above each other. The
         * connector lines run as absolute siblings between adjacent circles
         * so the circles never get pushed off-center the way a flex-with-gap
         * layout did. */}
        <div className="mt-8">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`,
            }}
          >
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              const prevDone = i > 0 && i - 1 < step;
              return (
                <div
                  key={label}
                  className="relative flex flex-col items-center gap-2"
                >
                  {/* connector to the previous circle: from this column's
                   * center going left to the previous column's center */}
                  {i > 0 && (
                    <div
                      aria-hidden
                      className={`absolute left-[-50%] right-1/2 top-4 h-px transition-colors ${
                        prevDone ? "bg-honey" : "bg-line"
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      done
                        ? "bg-honey text-ink"
                        : active
                          ? // Opaque background (matches the page bg) so the
                            // connector line behind the row never bleeds
                            // through the digit. The honey ring still gives
                            // it the "active" highlight.
                            "bg-ink ring-2 ring-honey text-honey"
                          : "bg-ink ring-1 ring-line text-muted"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={`text-center text-[11px] leading-tight transition-colors ${
                      active
                        ? "text-foreground"
                        : done
                          ? "text-fg-soft"
                          : "text-muted"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            Step <span className="text-foreground">{step + 1}</span> of{" "}
            {STEPS.length}
          </p>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{STEPS[step]}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* The form NEVER auto-submits. We strip the default submit
             * behaviour (preventDefault on submit) so pressing Enter inside
             * any input can't fire the campaign creation, and the final
             * "Sign & deposit" button calls handleSubmit() manually from its
             * onClick. This avoids the bug where the previous step's "Next"
             * click was inheriting onto a freshly-rendered submit button in
             * the same DOM slot. */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col gap-4"
            >
              {step === 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="brand">Brand name</Label>
                    <Input
                      id="brand"
                      placeholder="Chasqui Coffee"
                      aria-invalid={!!errors.brand}
                      {...register("brand")}
                    />
                    <FieldError message={errors.brand?.message} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product">Product description</Label>
                    <Textarea
                      id="product"
                      placeholder="Single-origin Yungas espresso · 250g bag · ships LATAM-wide"
                      aria-invalid={!!errors.product}
                      {...register("product")}
                    />
                    <FieldError message={errors.product?.message} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="storefrontUrl">Storefront URL</Label>
                    <Input
                      id="storefrontUrl"
                      placeholder="https://shop.halocola.com"
                      aria-invalid={!!errors.storefrontUrl}
                      {...register("storefrontUrl")}
                    />
                    <FieldError message={errors.storefrontUrl?.message} />
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
                      aria-invalid={!!errors.poolUsdc}
                      {...register("poolUsdc")}
                    />
                    <p className="text-xs text-muted">
                      Minimum $50. This goes into on-chain escrow at signing
                      time.
                    </p>
                    <FieldError message={errors.poolUsdc?.message} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deadlineDays">Deadline (days)</Label>
                    <Input
                      id="deadlineDays"
                      type="number"
                      min={1}
                      max={60}
                      aria-invalid={!!errors.deadlineDays}
                      {...register("deadlineDays")}
                    />
                    <FieldError message={errors.deadlineDays?.message} />
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
                      aria-invalid={!!errors.conversionValueUsdc}
                      {...register("conversionValueUsdc")}
                    />
                    <p className="text-xs text-muted">
                      This is what&apos;s distributed across everyone who
                      contributed to the sale (minus 5% platform fee).
                    </p>
                    <FieldError message={errors.conversionValueUsdc?.message} />
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
                {/* Distinct keys force React to mount a brand-new <button>
                 * when the step changes, instead of reusing the same DOM
                 * node and silently swapping its handlers mid-click. */}
                {step < STEPS.length - 1 ? (
                  <Button
                    key="step-next"
                    type="button"
                    size="sm"
                    onClick={nextStep}
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    key="step-submit"
                    type="button"
                    size="sm"
                    disabled={submitting}
                    onClick={handleSubmit(onSubmit)}
                  >
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

/**
 * Inline form error. Renders nothing when empty (so the layout doesn't shift
 * before the user has touched the field). Uses the semantic --error red, not
 * the orange `sting` accent — sting means "money in" elsewhere on the page.
 */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-error" role="alert">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
