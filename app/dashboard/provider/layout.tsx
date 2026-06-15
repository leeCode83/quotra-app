import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provider Dashboard — Quotra",
  description: "Manage your API listings, earnings, and provider settings on Quotra.",
};

export default function ProviderDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
