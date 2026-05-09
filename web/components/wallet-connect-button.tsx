"use client";

import dynamic from "next/dynamic";

// WalletMultiButton needs to load only on the client because the wallet adapters
// touch window/localStorage during initialization.
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

/**
 * Themed wrapper around the wallet-adapter modal trigger.
 * The button-color override is applied via CSS in globals.css (see .wallet-adapter-button overrides).
 */
export function WalletConnectButton() {
  return (
    <div className="hivework-wallet">
      <WalletMultiButton />
    </div>
  );
}
