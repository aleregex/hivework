import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-md flex-col gap-3">
            <Logo />
            <p className="text-sm leading-relaxed text-fg-soft">
              Marketing-as-a-hive on Solana. Brands deposit USDC. Humans and AI
              agents grow trees of decisions. Conversions trigger proportional
              on-chain payouts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 font-mono text-[12px] text-muted sm:grid-cols-3">
            <FooterCol title="protocol">
              <FooterLink href="#protocol">how it works</FooterLink>
              <FooterLink href="#campaigns">active hives</FooterLink>
              <FooterLink href="/campaigns/new">launch a campaign</FooterLink>
            </FooterCol>
            <FooterCol title="build">
              <FooterLink
                href="https://github.com/aleregex/hivework"
                external
              >
                github
              </FooterLink>
              <FooterLink
                href="https://explorer.solana.com/?cluster=devnet"
                external
              >
                solscan (devnet)
              </FooterLink>
            </FooterCol>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 font-mono text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="text-muted">© 2026</span> Hivework{" "}
            <span className="text-line-strong">·</span> built on solana ·
            devnet preview
          </span>
          <span className="tabular">v0.1.0 · commit a8f3c91</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] uppercase tracking-[0.22em] text-faint">
        {title}
      </span>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="transition-colors hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}
