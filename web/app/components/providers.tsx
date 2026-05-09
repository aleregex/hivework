"use client";

import { useMemo, type PropsWithChildren } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

// Default styles for the wallet modal. Tailwind classes will theme the buttons themselves.
import "@solana/wallet-adapter-react-ui/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tree updates need to feel live, but we don't want to hammer the RPC during the demo.
      refetchInterval: 3_000,
      staleTime: 1_500,
      retry: 1,
    },
  },
});

export function Providers({ children }: PropsWithChildren) {
  // NEXT_PUBLIC_RPC_ENDPOINT lets us point at a paid RPC during the demo if devnet gets congested.
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? clusterApiUrl("devnet"),
    []
  );

  // Backpack auto-injects via the standard wallet protocol, so we only need Phantom + Solflare here.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            {children}
            <Toaster theme="dark" position="bottom-right" richColors />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
