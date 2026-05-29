"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, Wallet, Key, Clock, ArrowUpRight, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet, useConsumerAuth } from "@/lib/web3/provider";
import { cn, formatAddress, formatPrice, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import type { ConsumerPermission, Transaction, Listing } from "@/types";

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  refunded: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function ConsumerDashboardPage() {
  const { session, isWrongChain, disconnect } = useWallet();
  useConsumerAuth();

  const { data: permissions = [], isLoading: permsLoading, error: permsError } = useQuery<ConsumerPermission[]>({
    queryKey: ["permissions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("permissions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions = [], isLoading: txLoading, error: txError } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("transactions").select("*");
      if (error) throw error;
      return data;
    },
  });

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
          Connect your wallet to access the consumer dashboard and manage your API permissions.
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

  const isLoading = permsLoading || txLoading;
  const queryError = permsError || txError;

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

  const totalSpent = transactions
    .filter((t) => t.status === "confirmed")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consumer Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your API access and track spending
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs self-start md:self-auto">
          {formatAddress(session.address)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Permissions</CardDescription>
            <CardTitle className="text-2xl">{permissions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">API keys with access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Spent</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1">
              <ArrowUpRight className="h-5 w-5 text-destructive" />
              {totalSpent.toFixed(4)} ETH
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transactions</CardDescription>
            <CardTitle className="text-2xl">{transactions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {transactions.filter((t) => t.status === "confirmed").length} confirmed
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="permissions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-4">
          {permissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Active Permissions</h3>
                <p className="text-muted-foreground mt-1">
                  Purchase access to an AI model from the marketplace to get started.
                </p>
                <Button className="mt-4" asChild>
                  <a href="/marketplace">Browse Marketplace</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            permissions.map((perm) => {
              const listing = listings.find((l) => l.id === perm.listing_id);
              const isExpired = perm.expires_at ? new Date(perm.expires_at) < new Date() : false;
              return (
                <Card key={perm.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{listing?.name ?? `Listing #${perm.listing_id}`}</h3>
                          <Badge variant={isExpired ? "destructive" : "success"} className="text-xs">
                            {isExpired ? "Expired" : "Active"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Key className="h-3.5 w-3.5" />
                            {perm.session_key.slice(0, 12)}...
                          </span>
                          {perm.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Expires {formatDate(perm.expires_at)}
                            </span>
                          )}
                        </div>
                        {perm.permissions_json && (
                          <div className="flex gap-2 mt-2">
                            {Object.entries(perm.permissions_json).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {listing?.endpoint_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={listing.endpoint_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" /> API
                            </a>
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
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No transactions yet.</p>
              </CardContent>
            </Card>
          ) : (
            transactions.map((tx) => (
              <Card key={tx.id}>
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">
                          {listings.find((l) => l.id === tx.listing_id)?.name ?? `Listing #${tx.listing_id}`}
                        </h3>
                        <Badge className={cn("text-xs", statusColors[tx.status] ?? "")}>
                          {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(tx.created_at)}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground mt-1 line-clamp-1">
                        {tx.tx_hash}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-primary">{formatPrice(parseFloat(tx.amount))}</p>
                      <p className="text-xs text-muted-foreground">per request</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
