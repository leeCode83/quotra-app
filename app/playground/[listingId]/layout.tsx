import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playground — Quotra",
  description: "Test and interact with AI APIs directly in the Quotra playground.",
};

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
