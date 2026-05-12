// React Query hooks for the api/ HTTP service. Use in client components.
// Server components should call apiFetch directly.

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  ApiCampaignConversionsResponse,
  ApiCampaignDetail,
  ApiCampaignSummary,
  ApiLeaf,
  ApiLeafByRef,
  ApiNode,
  ApiPaginated,
  ApiPortfolio,
} from "./types";

const KEYS = {
  campaigns: ["campaigns", "active"] as const,
  campaign: (id: string) => ["campaigns", id] as const,
  campaignConversions: (id: string) =>
    ["campaigns", id, "conversions"] as const,
  leafByRef: (refCode: string) => ["leaves", "by-ref", refCode] as const,
  portfolio: (address: string) => ["wallets", address, "portfolio"] as const,
};

export function useCampaigns(limit = 20, offset = 0) {
  return useQuery({
    queryKey: [...KEYS.campaigns, limit, offset],
    queryFn: () =>
      apiFetch<ApiPaginated<ApiCampaignSummary>>(
        `/campaigns/active?limit=${limit}&offset=${offset}`
      ),
    staleTime: 5_000,
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.campaign(id) : ["campaigns", "_disabled"],
    queryFn: () => apiFetch<ApiCampaignDetail>(`/campaigns/${id}`),
    enabled: Boolean(id),
    staleTime: 3_000,
  });
}

export function useCampaignConversions(
  id: string | undefined,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: id
      ? KEYS.campaignConversions(id)
      : ["campaigns", "_disabled", "conversions"],
    queryFn: () =>
      apiFetch<ApiCampaignConversionsResponse>(`/campaigns/${id}/conversions`),
    enabled: Boolean(id) && (opts.enabled ?? true),
    staleTime: 3_000,
  });
}

export function useLeafByRef(refCode: string | undefined) {
  return useQuery({
    queryKey: refCode ? KEYS.leafByRef(refCode) : ["leaves", "_disabled"],
    queryFn: () =>
      apiFetch<ApiLeafByRef>(`/leaves/by-ref/${encodeURIComponent(refCode!)}`),
    enabled: Boolean(refCode),
    staleTime: 30_000,
  });
}

export function usePortfolio(address: string | undefined) {
  return useQuery({
    queryKey: address ? KEYS.portfolio(address) : ["wallets", "_disabled"],
    queryFn: () =>
      apiFetch<ApiPortfolio>(
        `/wallets/${encodeURIComponent(address!)}/portfolio`
      ),
    enabled: Boolean(address),
    staleTime: 5_000,
  });
}

/**
 * POST /demo/convert. The api persists a pending row and forwards to the
 * oracle webhook. Status reflects what the oracle replied:
 *   - "pushed_to_chain": oracle signed + sent registerConversion, txSignature set
 *   - "pending": webhook not configured or unreachable; oracle poller will retry
 *   - "rejected": oracle returned 4xx (anti-fraud, backend verify, etc.)
 */
export async function postDemoConvert(input: {
  refCode: string;
  valueUsdc: number;
  buyerWallet?: string;
  source?: "demo_buy_page" | "manual" | "api";
}) {
  return apiFetch<{
    pendingConversionId: string;
    leafId: string;
    status: "pending" | "pushed_to_chain" | "rejected";
    txSignature: string | null;
    createdAt: string;
  }>("/demo/convert", { method: "POST", json: input });
}

// ---------- 2-step on-chain flows: draft → tx → finalize ----------
//
// Each pair below mirrors a flow from api/FRONTEND.md § "Two universal
// patterns". Drafts persist metadata; finalize closes the loop after the
// wallet's tx confirms on-chain. The actual tx is built in lib/anchor/tx.ts.

export async function postCampaignDraft(input: {
  brandName: string;
  productName: string;
  productDescription: string;
  redirectUrl: string;
  creatorWallet: string;
  poolUsdc: number;
  /** ISO 8601 timestamp when the campaign closes. */
  deadline: string;
  brandLogoUrl?: string | null;
  productImageUrl?: string | null;
}) {
  return apiFetch<ApiCampaignSummary>("/campaigns/draft", {
    method: "POST",
    json: input,
  });
}

export async function postCampaignFinalize(input: {
  draftId: string;
  onchainPda: string;
}) {
  return apiFetch<ApiCampaignSummary>("/campaigns/finalize", {
    method: "POST",
    json: input,
  });
}

export async function postNodeDraft(input: {
  campaignId: string;
  level: "L1" | "L2" | "L3";
  parentNodeId?: string | null;
  creatorWallet: string;
  title: string;
  description: string;
  examples?: unknown | null;
  tags?: string[];
  mediaUrls?: string[];
  stakeSol: number;
}) {
  return apiFetch<ApiNode>("/nodes/draft", { method: "POST", json: input });
}

export async function postNodeFinalize(input: {
  draftId: string;
  onchainPda: string;
}) {
  return apiFetch<ApiNode>("/nodes/finalize", {
    method: "POST",
    json: input,
  });
}

export async function postLeafDraft(input: {
  campaignId: string;
  path: [string, string, string];
  creatorWallet: string;
  contentUrl?: string | null;
  platform: "tiktok" | "instagram" | "x" | "youtube" | "other";
  stakeSol: number;
}) {
  return apiFetch<{
    leaf: ApiLeaf;
    reservation: { refCode: string; expiresAt: string };
  }>("/leaves/draft", { method: "POST", json: input });
}

export async function postLeafFinalize(input: {
  draftId: string;
  refCode: string;
  onchainPda: string;
}) {
  return apiFetch<ApiLeaf>("/leaves/finalize", {
    method: "POST",
    json: input,
  });
}
