import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — Quotra",
  description: "Documentation for integrating with the Quotra P2P AI API marketplace.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
