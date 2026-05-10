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
