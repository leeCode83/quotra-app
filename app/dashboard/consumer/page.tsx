"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, Wallet, Key, Clock, ArrowUpRight, ExternalLink, ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet, useConsumerAuth } from "@/lib/web3/provider";
import { formatAddress, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import { TransactionHistory, Transaction as TxProp } from "@/components/TransactionHistory";
import { RevokeDialog } from "@/components/RevokeDialog";
import type { ConsumerPermission, Transaction, Listing } from "@/types";

export default function ConsumerDashboardPage() {
  const { session, isWrongChain, disconnect } = useWallet();
  useConsumerAuth();
  const queryClient = useQueryClient();

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokePermId, setRevokePermId] = useState<string | null>(null);

  const { data: permissions = [], isLoading: permsLoading, error: permsError } = useQuery<ConsumerPermission[]>({
    queryKey: ["permissions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("consumer_permissions").select("*");
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

  const handleRevokeConfirm = async () => {
    if (!revokePermId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("consumer_permissions")
      .update({ status: "revoked" })
      .eq("id", revokePermId);
      
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ["permissions"] });
  };

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
    .filter((t) => t.status === "completed") // Note: updated from 'confirmed' to 'completed' based on DB enum
    .reduce((sum, t: Transaction) => sum + parseFloat(t.amount_usdc || "0"), 0);

  const activePermissions = permissions.filter(p => p.status === "active");

  const formattedTransactions: TxProp[] = transactions.map(tx => ({
    id: tx.id,
    txHash: tx.payment_tx_hash,
    amountUsdc: tx.amount_usdc,
    modelName: listings.find(l => l.id === tx.listing_id)?.model_name || "Unknown",
    status: tx.status as "pending" | "completed" | "refund_pending" | "refunded",
    timestamp: tx.created_at,
    completedAt: tx.completed_at
  }));

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
            <CardTitle className="text-2xl">{activePermissions.length}</CardTitle>
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
              {totalSpent.toFixed(4)} USDC
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
              {transactions.filter((t) => t.status === "completed").length} completed
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
                  <Link href="/marketplace">Browse Marketplace</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            permissions.map((perm) => {
              const listing = listings.find((l) => l.id === perm.listing_id);
              const isExpired = perm.expires_at ? new Date(perm.expires_at) < new Date() : false;
              const isRevoked = perm.status === "revoked";
              return (
                <Card key={perm.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{listing?.name ?? `Listing #${perm.listing_id}`}</h3>
                          <Badge variant={isRevoked ? "secondary" : isExpired ? "destructive" : "success"} className="text-xs">
                            {isRevoked ? "Revoked" : isExpired ? "Expired" : "Active"}
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
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isRevoked && !isExpired && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => {
                              setRevokePermId(perm.id);
                              setRevokeOpen(true);
                            }}
                          >
                            <ShieldAlert className="h-4 w-4 mr-1" /> Revoke
                          </Button>
                        )}
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
          <TransactionHistory transactions={formattedTransactions} title="Your Transactions" />
        </TabsContent>
      </Tabs>

      <RevokeDialog 
        open={revokeOpen} 
        onOpenChange={setRevokeOpen} 
        onConfirm={handleRevokeConfirm} 
      />
    </div>
  );
}
