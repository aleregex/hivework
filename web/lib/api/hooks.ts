// React Query hooks for the api/ HTTP service. Use in client components.
// Server components should call apiFetch directly.

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  ApiCampaignDetail,
  ApiCampaignSummary,
  ApiLeafByRef,
  ApiPaginated,
  ApiPortfolio,
} from "./types";

const KEYS = {
  campaigns: ["campaigns", "active"] as const,
  campaign: (id: string) => ["campaigns", id] as const,
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
 * POST /demo/convert. Returns the pending conversion id; the SSE stream will
 * confirm it on-chain a few seconds later.
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
    status: "pending";
    createdAt: string;
  }>("/demo/convert", { method: "POST", json: input });
}
