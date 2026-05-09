"use client";

import Link from "next/link";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-wax/60 bg-hive/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold"
        >
          <span aria-hidden className="text-xl">
            🐝
          </span>
          <span>
            <span className="text-foreground">Hive</span>
            <span className="text-honey">work</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm text-muted md:flex">
          <Link
            href="#how-it-works"
            className="transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            href="#campaigns"
            className="transition-colors hover:text-foreground"
          >
            Active campaigns
          </Link>
          <Link
            href="https://github.com/aleregex/hivework"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </Link>
        </div>

        <WalletConnectButton />
      </div>
    </nav>
  );
}
