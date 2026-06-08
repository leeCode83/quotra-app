"use client";

import { use, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Beaker, Check, Copy, Shield, Timer, Terminal, Wallet, Zap, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase-client";
import { formatPrice } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ListingWithProvider } from "@/types";
import { useAccount } from "wagmi";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { GrantPermissionButton } from "@/components/web3/GrantPermissionButton";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address, isConnected } = useAccount();
  const { connect } = useWalletConnection();

  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [savedPermissionContext, setSavedPermissionContext] = useState<any>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);

  const checkPermission = async () => {
    if (!address || !id) return;
    setIsCheckingPermission(true);
    try {
      const res = await fetch(`/api/permissions?listing_id=${id}&wallet_address=${address}`);
      const data = await res.json();
      if (data.hasPermission) {
        setSavedPermissionContext(data.permissionContext);
      }
    } catch (err) {
      console.error("Failed to check permission", err);
    } finally {
      setIsCheckingPermission(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, id]);

  const { data: listing, isLoading, error } = useQuery<ListingWithProvider>({
    queryKey: ["listing", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("listings")
        .select("*, provider:providers(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ListingWithProvider;
    },
  });

  const handleCopyEndpoint = () => {
    if (!listing) return;
    const url = (process.env.NEXT_PUBLIC_APP_URL || "https://quotra.app") + "/api/v1/" + (listing.delegation_id || "{delegation_id}") + "/chat";
    navigator.clipboard.writeText(url);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="h-48 bg-muted rounded-xl animate-pulse" />
              <div className="h-36 bg-muted rounded-xl animate-pulse" />
            </div>
            <div className="h-64 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (error || !listing) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-2xl font-bold">!</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Listing Not Found</h2>
          <p className="text-muted-foreground mb-6">This listing may have been removed or doesn&apos;t exist.</p>
          <Button asChild>
            <Link href="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  const isActive = listing.status === "active";
  const quotaUsed = listing.max_calls - listing.remaining_calls;
  const quotaPercent = listing.max_calls > 0 ? Math.round((quotaUsed / listing.max_calls) * 100) : 0;
  const gatewayUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://quotra.app") + "/api/v1/" + (listing.delegation_id || "{delegation_id}") + "/chat";
  const providerName = listing.provider?.name || (listing.provider?.wallet_address
    ? listing.provider.wallet_address.slice(0, 6) + "..." + listing.provider.wallet_address.slice(-4)
    : "Unknown");
  const hasDelegation = !!listing.delegation_id;

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[25rem] h-[25rem] bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <Button variant="ghost" className="mb-6 -ml-3 text-muted-foreground hover:text-foreground" asChild>
              <Link href="/marketplace">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Marketplace
              </Link>
            </Button>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <motion.div variants={itemVariants}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-purple-500/20">
                    {providerName[0]?.toUpperCase() || "A"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{listing.name}</h1>
                      <Badge variant={isActive ? "default" : "secondary"} className="gap-1.5">
                        {isActive && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                          </span>
                        )}
                        {listing.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">by {providerName}</p>
                  </div>
                </div>
              </motion.div>

              <Tabs defaultValue="overview" className="space-y-6">
                <motion.div variants={itemVariants}>
                  <TabsList className="bg-background/50 backdrop-blur-md border border-purple-500/10 p-1 w-full justify-start h-auto flex-wrap">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 rounded-md">Overview</TabsTrigger>
                    <TabsTrigger value="integration" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 rounded-md">Integration Guide</TabsTrigger>
                  </TabsList>
                </motion.div>

                <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                  <Card className="overflow-hidden border-purple-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        About
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {listing.description || "No description provided."}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border-purple-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-purple-500" />
                        API Specifications
                      </CardTitle>
                      <CardDescription>Gateway and parameter details for integration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</p>
                          <p className="font-semibold">{listing.model_name}</p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gateway Endpoint</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-muted px-2 py-1 rounded border truncate">
                              {gatewayUrl}
                            </code>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopyEndpoint}>
                              {copiedEndpoint ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Max Input</p>
                          <p className="font-semibold">{listing.max_input_chars.toLocaleString()} chars</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Max Output</p>
                          <p className="font-semibold">{listing.max_completion_tokens.toLocaleString()} tokens</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Delegation ID</p>
                          <p className="font-semibold font-mono text-sm truncate" title={listing.delegation_id || undefined}>
                            {listing.delegation_id ? listing.delegation_id.slice(0, 8) + "..." : "--"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Network</p>
                          <p className="font-semibold">Base Sepolia</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="integration" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                  <Card className="overflow-hidden border-purple-500/5">
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-lg">Quickstart Guide</CardTitle>
                      <CardDescription>Integrate this AI model into your application</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-8">
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 font-semibold border border-purple-500/20">1</div>
                          <h3 className="text-base font-semibold">Get Permission</h3>
                        </div>
                        <div className="ml-11 text-sm text-muted-foreground space-y-3">
                          <p>Before you can call this endpoint, you must grant a payment permission via ERC-7715. This allows the gateway to deduct USDC for each successful call.</p>
                          {!isConnected ? (
                            <Button variant="outline" className="gap-2 border-purple-500/20 hover:bg-purple-500/10" onClick={() => connect()}>
                              <Wallet className="h-4 w-4 text-purple-500" />
                              Connect Wallet to Grant Permission
                            </Button>
                          ) : savedPermissionContext ? (
                            <div className="flex items-center gap-2 text-green-500 font-medium text-sm py-2">
                              <Check className="h-4 w-4" />
                              Permission Granted
                            </div>
                          ) : isCheckingPermission ? (
                            <Button variant="outline" disabled className="gap-2 border-purple-500/20">
                              <Loader2 className="h-4 w-4 animate-spin text-purple-500" /> Checking Status...
                            </Button>
                          ) : (
                            <div className="pt-2">
                              <GrantPermissionButton listingId={listing.id} onGranted={checkPermission} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 font-semibold border border-purple-500/20">2</div>
                          <h3 className="text-base font-semibold">Install Client SDK</h3>
                        </div>
                        <div className="ml-11">
                          <p className="text-sm text-muted-foreground mb-3">Install our lightweight HTTP client to handle the 402 payment flow automatically.</p>
                          <div className="bg-muted rounded-md p-3 font-mono text-xs text-muted-foreground border">
                            npm install @x402/client
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 font-semibold border border-purple-500/20">3</div>
                          <h3 className="text-base font-semibold">Call the API</h3>
                        </div>
                        <div className="ml-11">
                          <p className="text-sm text-muted-foreground mb-3">Initialize the client with your session key and make a request to the gateway.</p>
                          <div className="bg-muted rounded-md p-4 font-mono text-xs overflow-x-auto border">
                            <pre>{`import { X402Client } from "@x402/client";

// 1. Initialize client with the session key from step 1
const client = new X402Client({
  sessionKey: process.env.QUOTRA_SESSION_KEY
});

// 2. Make the request
const response = await client.fetch("${gatewayUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat: "Explain quantum computing in simple terms.",
    systemPrompt: "You are an expert physicist." // Optional
  })
});

const data = await response.json();
console.log(data.text);`}</pre>
                          </div>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <motion.div variants={itemVariants}>
              <div className="md:sticky md:top-24 space-y-4">
                <Card className="border-purple-500/10 shadow-lg shadow-purple-500/5 md:backdrop-blur-xl md:bg-background/80">
                  <CardContent className="p-6 space-y-6">
                    <div className="text-center pb-4 border-b">
                      <p className="text-4xl font-bold text-primary">
                        ${formatPrice(parseFloat(listing.price_per_call_usdc))}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">per request</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quota Used</span>
                        <span className="font-medium tabular-nums">{quotaUsed} / {listing.max_calls}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: quotaPercent + "%" }}
                          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{listing.remaining_calls} remaining</span>
                        <span>{quotaPercent}% used</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Expires</span>
                      <span className="font-medium ml-auto">{new Date(listing.expires_at).toLocaleDateString()}</span>
                    </div>

                    <div className="pt-2 space-y-3">
                      {!isConnected ? (
                        <Button className="w-full h-11 gap-2" onClick={() => connect()}>
                          <Wallet className="h-4 w-4" />
                          Connect Wallet to Use
                        </Button>
                      ) : !isActive ? (
                        <Button className="w-full h-11" disabled>Listing Inactive</Button>
                      ) : hasDelegation ? (
                        savedPermissionContext ? (
                          <Button className="w-full h-11 gap-2" asChild>
                            <Link href={"/playground/" + listing.id}>
                              <Beaker className="h-4 w-4" />
                              Try in Playground
                            </Link>
                          </Button>
                        ) : isCheckingPermission ? (
                          <Button className="w-full h-11 gap-2" disabled>
                            <Loader2 className="h-4 w-4 animate-spin" /> Checking...
                          </Button>
                        ) : (
                          <GrantPermissionButton listingId={listing.id} onGranted={checkPermission} />
                        )
                      ) : (
                        <Button className="w-full h-11" disabled>No delegation configured</Button>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Secure Payment
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Pay Per Call
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {hasDelegation && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-lg p-4 z-50">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div>
              <p className="text-lg font-bold text-primary">
                ${formatPrice(parseFloat(listing.price_per_call_usdc))}
              </p>
              <p className="text-xs text-muted-foreground">per request</p>
            </div>
            <div className="min-w-0 max-w-[180px]">
              <Button className="w-full h-10 text-sm gap-1.5" asChild>
                <Link href={"/playground/" + listing.id}>
                  <Beaker className="h-4 w-4" /> Try Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
