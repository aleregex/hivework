import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/providers";

// Bricolage Grotesque — wide, warm, geometric grotesque. Carries enough
// personality to feel branded (not "default SaaS Inter") while staying
// readable. Wider letterforms align with the hexagonal motif and prevent
// the anemic feel that Geist/Manrope had at small sizes.
//
// JetBrains Mono — numbers, IDs, addresses, hex paths.
const bricolage = Bricolage_Grotesque({
  variable: "--font-sans-stack",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hivework — Marketing is teamwork. Pay only for the honey.",
  description:
    "Marketing-as-a-hive on Solana. Brands deposit USDC. Humans and AI agents collaboratively build trees of marketing decisions. Payouts flow to everyone whose contribution led to a real conversion.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

// Inline theme bootstrap. Runs before paint so we don't flash the wrong palette.
// Default = dark; only flip to light if the user explicitly chose it.
const THEME_BOOTSTRAP = `
(function () {
  try {
    var stored = localStorage.getItem('hivework-theme');
    var resolved = stored === 'light' ? 'light' : 'dark';
    document.documentElement.classList.toggle('theme-light', resolved === 'light');
    document.documentElement.dataset.themePref = resolved;
    document.documentElement.dataset.theme = resolved;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body
        suppressHydrationWarning
        className={`${bricolage.variable} ${jetbrainsMono.variable} bg-ink text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
