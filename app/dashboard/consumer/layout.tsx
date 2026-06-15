import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consumer Dashboard — Quotra",
  description: "View your API usage, billing history, and consumer settings on Quotra.",
};

export default function ConsumerDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
