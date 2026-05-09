import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-wax/60 bg-hive">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-2xl">
              🐝
            </span>
            <div>
              <p className="text-base font-semibold">
                <span className="text-foreground">Hive</span>
                <span className="text-honey">work</span>
              </p>
              <p className="text-xs text-muted">
                Marketing-as-a-hive on Solana. Built at the hackathon, opened to
                the world.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted">
            <Link
              href="https://github.com/aleregex/hivework"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </Link>
            <Link
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Solscan (devnet)
            </Link>
            <Link
              href="#how-it-works"
              className="transition-colors hover:text-foreground"
            >
              How it works
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-wax/40 pt-6 text-xs text-muted">
          <span>© 2026 Hivework — built on Solana · devnet preview</span>
        </div>
      </div>
    </footer>
  );
}
