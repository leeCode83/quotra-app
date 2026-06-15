import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace — Quotra",
  description: "Browse and discover AI APIs listed on the Quotra marketplace.",
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
