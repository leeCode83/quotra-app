import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet — Quotra",
  description: "Manage your wallet and view transaction history on Quotra.",
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
