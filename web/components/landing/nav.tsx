"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="Hivework">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 font-mono text-[12px] text-muted md:flex">
          <NavLink href="#protocol">protocol</NavLink>
          <NavLink href="#campaigns">campaigns</NavLink>
          <NavLink
            href="https://github.com/aleregex/hivework"
            external
          >
            github
          </NavLink>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/campaigns/new"
            className="hidden font-mono text-[12px] text-muted transition-colors hover:text-foreground sm:inline-flex"
          >
            <span className="text-honey">›</span>&nbsp;new campaign
          </Link>
          <WalletConnectButton />
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="rounded-md px-3 py-1.5 transition-colors hover:bg-surface hover:text-foreground"
    >
      {children}
    </Link>
  );
}
