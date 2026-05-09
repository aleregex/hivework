// Placeholder landing for the very first deploy. The real landing lands in Task #3.
// Keeping it tiny on purpose so the Vercel deploy proves the pipeline works.

export default function Home() {
  return (
    <main className="bg-honeycomb relative min-h-screen overflow-x-clip">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <span className="rounded-full border border-wax bg-comb px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-honey">
          🐝 Hivework · devnet preview
        </span>
        <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          Marketing is teamwork.{" "}
          <span className="text-honey">Pay only for the honey.</span>
        </h1>
        <p className="max-w-2xl text-balance text-base leading-relaxed text-muted sm:text-lg">
          Brands deposit USDC into escrow. Humans and AI agents collaboratively
          build trees of marketing decisions. When a real conversion happens,
          payouts flow proportionally to every contributor in the genealogical
          path that led to the sale.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <span className="rounded-md border border-wax bg-comb px-3 py-2 font-mono text-xs text-muted">
            Status: scaffold ready · landing in progress
          </span>
        </div>
      </div>
    </main>
  );
}
