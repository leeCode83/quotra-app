"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { createClient } from "@/lib/supabase-client";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_EXPLORER_URL } from "@/lib/web3/config";
import {
  Wallet,
  Link2,
  Unlink,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Activity,
} from "lucide-react";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(balance: string | null): string {
  if (!balance) return "0.0000";
  const num = parseFloat(balance);
  if (isNaN(num)) return "0.0000";
  return num.toFixed(4);
}

interface TransactionItem {
  id: string;
  type: "deposit" | "withdraw" | "payment" | "claim";
  amount: string;
  status: "confirmed" | "pending" | "failed";
  timestamp: string;
  txHash?: string;
}

function TransactionRow({ tx }: { tx: TransactionItem }) {
  const typeColors: Record<string, string> = {
    deposit: "text-green-600 dark:text-green-400",
    withdraw: "text-orange-600 dark:text-orange-400",
    payment: "text-blue-600 dark:text-blue-400",
    claim: "text-purple-600 dark:text-purple-400",
  };

  const typeLabels: Record<string, string> = {
    deposit: "Deposit",
    withdraw: "Withdraw",
    payment: "Payment",
    claim: "Claim",
  };

  const statusIcon =
    tx.status === "confirmed" ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : tx.status === "pending" ? (
      <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-red-500" />
    );

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Activity className="h-4 w-4 text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {typeLabels[tx.type]}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(tx.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-sm font-semibold ${typeColors[tx.type]}`}>
          {tx.type === "payment" || tx.type === "withdraw" ? "-" : "+"}
          {tx.amount} USDC
        </span>
        <div className="flex items-center gap-1">{statusIcon}</div>
        {tx.txHash && (
          <a
            href={`${BASE_SEPOLIA_EXPLORER_URL}/tx/${tx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  const {
    address,
    isConnected,
    isConnecting,
    isWrongChain,
    balance,
    errorMessage,
    connect,
    disconnect,
    switchChain,
  } = useWalletConnection();

  const [copied, setCopied] = useState(false);
  const [showTransactions, setShowTransactions] = useState(true);

  const { data: transactions = [], isLoading, error } = useQuery<TransactionItem[]>({
    queryKey: ["wallet-transactions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((tx) => ({
        id: tx.id,
        type: "payment" as const,
        amount: tx.amount_usdc ? tx.amount_usdc.toString() : "0.0000",
        status: tx.status === "refunded" ? "failed" as const : tx.status as "confirmed" | "pending" | "failed",
        timestamp: tx.created_at,
        txHash: tx.payment_tx_hash,
      }));
    },
  });

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Wallet
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage your blockchain connection and transactions
          </p>
        </div>

        {/* Connection Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <Wallet className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Connection Status
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {isConnected ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                      </span>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Connected
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex rounded-full h-2.5 w-2.5 bg-zinc-300 dark:bg-zinc-600"></span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Disconnected
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isConnected ? (
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Link2 className="h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
              </div>
            </div>
          )}

          {isConnected && address && (
            <div className="space-y-4">
              {/* Address */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Wallet Address
                </p>
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                    {truncateAddress(address)}
                  </code>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyAddress}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title="Copy address"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <a
                      href={`${BASE_SEPOLIA_EXPLORER_URL}/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title="View on explorer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Network */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Network
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        isWrongChain ? "bg-red-500" : "bg-green-500"
                      }`}
                    ></span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {baseSepolia.name}
                    </span>
                  </div>
                  {isWrongChain && (
                    <button
                      onClick={switchChain}
                      className="rounded-lg bg-amber-100 dark:bg-amber-950 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                    >
                      Switch to Base Sepolia
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Chain ID: {baseSepolia.id}
                </p>
              </div>

              {/* Balance */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Balance
                </p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatBalance(balance?.formatted ?? null)} {balance?.symbol ?? "ETH"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Base Sepolia Testnet
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Transactions */}
        {isConnected && (
          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
            <button
              onClick={() => setShowTransactions(!showTransactions)}
              className="flex items-center justify-between w-full"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Recent Transactions
              </h2>
              <ChevronDown
                className={`h-5 w-5 text-zinc-500 transition-transform ${
                  showTransactions ? "rotate-180" : ""
                }`}
              />
            </button>

            {showTransactions && (
              <div className="mt-4 space-y-2">
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 animate-pulse"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                          <div className="space-y-1">
                            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
                            <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
                          <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-700 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Failed to load transactions
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">{(error as Error).message}</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No transactions yet
                    </p>
                  </div>
                ) : (
                  transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
