import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

test("GET /health returns ok and confirms DB connectivity", async () => {
  const res = await app.inject({ method: "GET", url: "/health" });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { status: string; db: string };
  assert.equal(body.status, "ok");
  assert.equal(body.db, "up");
});

test("GET /campaigns/active returns paginated list", async () => {
  const res = await app.inject({ method: "GET", url: "/campaigns/active?limit=5" });
  assert.equal(res.statusCode, 200);
  const body = res.json() as {
    items: Array<{ id: string; status: string; brand: { name: string } }>;
    meta: { limit: number; offset: number; total: number };
  };
  assert.ok(Array.isArray(body.items));
  assert.equal(body.meta.limit, 5);
  assert.equal(body.meta.offset, 0);
  for (const item of body.items) {
    assert.equal(item.status, "active");
    assert.ok(typeof item.brand.name === "string");
  }
});

test("POST /demo/convert rejects unknown ref_codes with 404", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/demo/convert",
    payload: {
      refCode: "zzzzzzzz",
      valueUsdc: 24,
      source: "demo_buy_page",
    },
  });
  assert.equal(res.statusCode, 404);
  const body = res.json() as { error: string };
  assert.equal(body.error, "ref_code_not_found");
});

test("GET /leaves/by-ref/:refCode returns 404 for unknown ref_code", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/leaves/by-ref/zzzzzzzz",
  });
  assert.equal(res.statusCode, 404);
  const body = res.json() as { error: string };
  assert.equal(body.error, "ref_code_not_found");
});

test("GET /wallets/:address/portfolio returns extended shape with pending payouts", async () => {
  // Random base58 pubkey that will have no contributions — exercises the empty path.
  const res = await app.inject({
    method: "GET",
    url: "/wallets/EMwSrLzbFfU5PvcrnP1jkf2QJdeRJvEXoghTVpnM3Va4/portfolio",
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as {
    wallet: string;
    nodes: unknown[];
    leaves: unknown[];
    stakedSol: string;
    pendingPayoutsUsdc: string;
    pendingByCampaign: unknown[];
    claimHistory: unknown[];
    lifetimeClaimedUsdc: string;
  };
  assert.ok(typeof body.wallet === "string");
  assert.ok(Array.isArray(body.nodes));
  assert.ok(Array.isArray(body.leaves));
  assert.ok(Array.isArray(body.pendingByCampaign));
  assert.ok(Array.isArray(body.claimHistory));
  assert.equal(typeof body.stakedSol, "string");
  assert.equal(typeof body.pendingPayoutsUsdc, "string");
  assert.equal(typeof body.lifetimeClaimedUsdc, "string");
});
