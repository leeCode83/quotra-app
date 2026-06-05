"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, Wallet, Clock, ArrowUpRight, Beaker
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/lib/web3/provider";
import { formatAddress } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import { TransactionHistory, Transaction as TxProp } from "@/components/TransactionHistory";
import type { Transaction, Listing } from "@/types";

export default function ConsumerDashboardPage() {
  const { session, isWrongChain, disconnect } = useWallet();

  const [txPage, setTxPage] = useState(1);
  const txPerPage = 10;

  const { data: consumer, isLoading: consumerLoading } = useQuery({
    queryKey: ["consumer", session.address],
    queryFn: async () => {
      if (!session.address) return null;
      const supabase = createClient();
      const { data, error } = await supabase.from("consumers").select("*").ilike("wallet_address", session.address).single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!session.address,
  });

  const { data: txData, isLoading: txLoading, error: txError } = useQuery({
    queryKey: ["transactions", consumer?.id, txPage],
    queryFn: async () => {
      if (!consumer?.id) return { data: [], count: 0 };
      const supabase = createClient();
      const from = (txPage - 1) * txPerPage;
      const to = from + txPerPage - 1;
      const { data, error, count } = await supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .eq("consumer_id", consumer.id)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: data as Transaction[], count: count || 0 };
    },
    enabled: !!consumer?.id,
  });

  const transactions = txData?.data || [];
  const txTotalCount = txData?.count || 0;

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["consumer-listings"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("listings").select("*");
      if (error) throw error;
      return data;
    },
  });

  if (!session.isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Connect your wallet to access the consumer dashboard and view your API usage history.
        </p>
      </div>
    );
  }

  if (isWrongChain) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Wrong Network</h1>
        <p className="text-muted-foreground mt-2">
          Please switch to Base Sepolia testnet to use the consumer dashboard.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => disconnect()}>
          Disconnect Wallet
        </Button>
      </div>
    );
  }

  const isLoading = consumerLoading || txLoading;
  const queryError = txError;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-8">
                  <div className="h-4 w-24 bg-muted rounded mb-2" />
                  <div className="h-8 w-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Failed to Load Data</h2>
        <p className="text-muted-foreground mt-1">{(queryError as Error).message}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const totalSpent = consumer ? parseFloat(consumer.total_spent_usdc || "0") : 0;

  // Build unique listing IDs from transactions for the "used" count
  const usedListingIds = new Set(transactions.map((tx) => tx.listing_id));

  const formattedTransactions: TxProp[] = transactions.map((tx) => ({
    id: tx.id,
    txHash: tx.payment_tx_hash,
    amountUsdc: tx.amount_usdc,
    modelName: listings.find((l) => l.id === tx.listing_id)?.model_name || "Unknown",
    status: tx.status as "pending" | "completed" | "refund_pending" | "refunded",
    timestamp: tx.created_at,
    completedAt: tx.completed_at,
    type: "expense" as const,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consumer Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your AI model usage and spending
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs self-start md:self-auto">
          {formatAddress(session.address)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Models Used</CardDescription>
            <CardTitle className="text-2xl">{usedListingIds.size}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Distinct AI models accessed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Spent</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1">
              <ArrowUpRight className="h-5 w-5 text-destructive" />
              {totalSpent.toFixed(4)} USDC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Pay-per-call payments via x402</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transactions</CardDescription>
            <CardTitle className="text-2xl">{txTotalCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total payment records
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">My Models</TabsTrigger>
          <TabsTrigger value="transactions">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          {usedListingIds.size === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Beaker className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Models Used Yet</h3>
                <p className="text-muted-foreground mt-1">
                  Browse the marketplace and try an AI model to get started.
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/marketplace">Browse Marketplace</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            Array.from(usedListingIds).map((listingId) => {
              const listing = listings.find((l) => l.id === listingId);
              const modelTxs = transactions.filter((tx) => tx.listing_id === listingId);
              return (
                <Card key={listingId}>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{listing?.name ?? "Unknown Model"}</h3>
                          <Badge variant="outline" className="text-xs font-mono">
                            {listing?.model_name ?? "--"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {modelTxs.length} call{modelTxs.length !== 1 ? "s" : ""}
                          </span>
                          <span>
                            {parseFloat(
                              modelTxs.reduce((sum, tx) => sum + parseFloat(tx.amount_usdc), 0).toFixed(6)
                            )}{" "}
                            USDC total
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {listing?.delegation_id && (
                          <Button size="sm" className="gap-1.5" asChild>
                            <Link href={"/playground/" + listingId}>
                              <Beaker className="h-4 w-4" /> Try Again
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <TransactionHistory transactions={formattedTransactions} title="Payment History" />

          {txTotalCount > txPerPage && (
            <div className="flex justify-between items-center mt-4 bg-card p-4 rounded-md border border-border">
              <Button
                variant="outline"
                onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                disabled={txPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground font-medium">
                Page {txPage} of {Math.ceil(txTotalCount / txPerPage)}
              </span>
              <Button
                variant="outline"
                onClick={() => setTxPage((p) => p + 1)}
                disabled={txPage >= Math.ceil(txTotalCount / txPerPage)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
