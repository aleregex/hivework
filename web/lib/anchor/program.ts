// Hook to obtain an AnchorProvider + Program bound to the connected wallet.
// Use inside client components only — depends on @solana/wallet-adapter-react.

"use client";

import { useMemo } from "react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { HIVEWORK_IDL } from "./idl";

/**
 * Returns a Program instance for the connected wallet, or null if the wallet
 * isn't connected yet. Memoized on (connection, wallet) so re-renders don't
 * thrash the Anchor object.
 */
export function useHiveworkProgram(): Program | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      preflightCommitment: "confirmed",
      commitment: "confirmed",
    });
    return new Program(HIVEWORK_IDL, provider);
  }, [connection, wallet]);
}
