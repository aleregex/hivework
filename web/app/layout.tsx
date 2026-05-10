import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/providers";

// Geist as the display/UI face — sharp, technical, sized like a CLI.
// JetBrains Mono is reserved for numbers, IDs, addresses, hex paths —
// anything that should read as "computed by the system, not written by a copywriter."
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className={`${geist.variable} ${jetbrainsMono.variable} bg-ink text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
