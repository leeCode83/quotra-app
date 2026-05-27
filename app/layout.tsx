import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { config } from "@/lib/web3/config";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quotra — Decentralized P2P AI API Marketplace",
  description:
    "Trade AI APIs trustlessly on Base. Connect AI providers with consumers through on-chain escrow.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialState = cookieToInitialState(config, (await headers()).get("cookie"));
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <Providers initialState={initialState}>
          <Navbar />
          <main className="flex-1"><ErrorBoundary>{children}</ErrorBoundary></main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}