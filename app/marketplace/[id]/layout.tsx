import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Listing — Quotra",
  description: "View details for a specific AI API listing on Quotra.",
};

export default function ListingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
