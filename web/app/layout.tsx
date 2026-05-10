import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/providers";

// Typography stack:
//   Fraunces      — display serif for headings + the wordmark. Gives the
//                    brand actual personality (vs. "default grotesque").
//   Inter         — body. Neutral, calm, optimised for UI sizes 13–18.
//   JetBrains Mono — strictly for code, hashes, USDC amounts, numeric tags.
// Loaded as a true variable font: omitting `weight` lets Next.js ship the full
// axis range, which is required when we declare custom `axes` (opsz/SOFT).
// We then drive weight via Tailwind's `font-*` utilities at the call site.
const fraunces = Fraunces({
  variable: "--font-display-stack",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});

const inter = Inter({
  variable: "--font-sans-stack",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
        className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} bg-ink text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
