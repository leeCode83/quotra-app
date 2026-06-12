"use client";

import { use, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Beaker, Check, Copy, Timer, Terminal, Wallet, Zap, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CallsBar } from "@/components/CallsBar";
import NumberFlow from "@number-flow/react";
import type { ListingWithProvider } from "@/types";
import { useAccount } from "wagmi";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { GrantPermissionButton } from "@/components/web3/GrantPermissionButton";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-md border bg-[#1E1E1E] overflow-hidden">
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1E1E1E]/80 backdrop-blur-sm rounded">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

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
      const res = await fetch(`/api/permissions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: address }),
      });
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
    const url = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/v1/" + listing.id + "/chat";
    navigator.clipboard.writeText(url);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="space-y-3">
            <div className="h-8 w-2/3 bg-muted rounded animate-pulse" />
            <div className="h-4 w-1/4 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-64 bg-muted rounded-2xl animate-pulse" />
          <div className="h-52 bg-muted rounded-2xl animate-pulse" />
        </div>
      </motion.div>
    );
  }

  if (error || !listing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container mx-auto px-4 py-8">
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
  const price = parseFloat(listing.price_per_call_usdc?.toString() || "0");
  const gatewayUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/v1/" + listing.id + "/chat";
  const providerName = listing.provider?.name || (listing.provider?.wallet_address
    ? listing.provider.wallet_address.slice(0, 6) + "..." + listing.provider.wallet_address.slice(-4)
    : "Unknown");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <div className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Button variant="ghost" className="-ml-3 text-muted-foreground hover:text-foreground" asChild>
            <Link href="/marketplace">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Marketplace
            </Link>
          </Button>

          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{listing.name}</h1>
              <span className={cn(
                "h-2.5 w-2.5 rounded-full animate-pulse",
                isActive ? "bg-green-500" : "bg-muted-foreground/50"
              )} />
              <Badge variant="secondary" className="font-normal text-xs">{listing.model_name}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">by {providerName}</p>
          </div>

          <div className="rounded-2xl border border-foreground/10 p-6 md:p-8 space-y-6">
            <div>
              <p className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                <NumberFlow
                  value={price}
                  format={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4,
                  }}
                />
                <span className="text-base md:text-xl text-muted-foreground font-normal tracking-normal ml-1">/req</span>
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">{Number(listing.remaining_calls)} / {Number(listing.max_calls)} calls</span>
              </div>
              <CallsBar used={Number(listing.remaining_calls)} total={Number(listing.max_calls)} />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4 shrink-0" />
              <span>Expires {new Date(listing.expires_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric"
              })}</span>
            </div>

            <div className="border-t border-foreground/10 pt-5 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="gap-2" asChild>
                <Link href={"/playground/" + listing.id}>
                  <Beaker className="h-4 w-4" />
                  Try Free Trial
                </Link>
              </Button>

              {!isConnected ? (
                <Button className="gap-2" onClick={() => connect()}>
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
              ) : !isActive ? (
                <Button disabled>Listing Inactive</Button>
              ) : savedPermissionContext ? (
                <div className="flex items-center gap-2 text-green-500 font-medium text-sm px-4 py-2">
                  <Check className="h-4 w-4" />
                  Permission Granted
                </div>
              ) : isCheckingPermission ? (
                <Button disabled variant="outline" className="gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking Status...
                </Button>
              ) : (
                <GrantPermissionButton listingId={listing.id} onGranted={checkPermission} />
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> Pay Per Call
              </span>
            </div>
          </div>

          <Tabs defaultValue={savedPermissionContext ? "integration" : "overview"}>
            <TabsList className="bg-background border border-foreground/10 p-1 w-full justify-start h-auto flex-wrap">
              <TabsTrigger value="overview" className="rounded-md">Overview</TabsTrigger>
              <TabsTrigger value="integration" className="rounded-md">Integration Guide</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
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

            <TabsContent value="integration" className="space-y-6 mt-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg">Quickstart Guide</CardTitle>
                  <CardDescription>Integrate this AI model into your application</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold border text-sm">1</div>
                      <h3 className="text-base font-semibold">Get Permission</h3>
                    </div>
                    <div className="ml-11 text-sm text-muted-foreground space-y-3">
                      <p>Before you can call this endpoint, you must grant a session permission via ERC-7715. This authorizes your session key to make requests. Payments are handled per-call via x402.</p>
                      {!isConnected ? (
                        <Button variant="outline" className="gap-2" onClick={() => connect()}>
                          <Wallet className="h-4 w-4" />
                          Connect Wallet to Grant Permission
                        </Button>
                      ) : savedPermissionContext ? (
                        <div className="flex items-center gap-2 text-green-500 font-medium text-sm py-2">
                          <Check className="h-4 w-4" />
                          Permission Granted
                        </div>
                      ) : isCheckingPermission ? (
                        <Button variant="outline" disabled className="gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Checking Status...
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
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold border text-sm">2</div>
                      <h3 className="text-base font-semibold">Install Client SDK</h3>
                    </div>
                    <div className="ml-11">
                      <p className="text-sm text-muted-foreground mb-3">Install our lightweight HTTP client to handle the 402 payment flow automatically.</p>
                      <CodeBlock language="bash" code="npm install @x402/fetch @x402/core" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold border text-sm">3</div>
                      <h3 className="text-base font-semibold">Call the API</h3>
                    </div>
                    <div className="ml-11">
                      <p className="text-sm text-muted-foreground mb-3">Use the x402 HTTP client with your preferred signer (Wallet or Private Key). It auto-handles the 402 payment flow.</p>
                      <Tabs defaultValue="client-side" className="w-full">
                        <TabsList className="bg-background border border-foreground/10 p-1 mb-4 h-auto">
                          <TabsTrigger value="client-side" className="rounded-md text-xs">Client Side</TabsTrigger>
                          <TabsTrigger value="server-side" className="rounded-md text-xs">Server Side</TabsTrigger>
                        </TabsList>
                        <TabsContent value="client-side" className="m-0">
                          <CodeBlock language="typescript" code={`import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/core";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createWalletClient, custom } from "viem";

// 1. Create x402 client with your EOA wallet as signer
const walletClient = createWalletClient({
  transport: custom(window.ethereum),
});
const x402 = new x402Client()
  .register("eip155:*", new ExactEvmScheme({
    signer: {
      signMessage: (msg) => walletClient.signMessage({ message: msg }),
    },
  }));

const fetchWithPayment = wrapFetchWithPayment(fetch, x402);

// 2. Call gateway — 402 payment is handled automatically
const response = await fetchWithPayment("${gatewayUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-wallet-address": walletClient.account.address,
  },
  body: JSON.stringify({
    chat: "Explain quantum computing in simple terms.",
    systemPrompt: "You are an expert physicist." // Optional
  })
});

const data = await response.json();
console.log(data.text);`} />
                        </TabsContent>
                        <TabsContent value="server-side" className="m-0">
                          <CodeBlock language="typescript" code={`import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPayment } from "@x402/fetch";
import { http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// 1. Create signer from private key
const pk = process.env.PRIVATE_KEY; // e.g. 0x...
const account = privateKeyToAccount(pk);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const signer = toClientEvmSigner(account, publicClient);

// 2. Create x402 client with ExactEvmScheme
const client = new x402Client();
registerExactEvmScheme(client, { signer });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// 3. Call gateway — 402 payment is handled automatically
const response = await fetchWithPayment("${gatewayUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-wallet-address": account.address,
  },
  body: JSON.stringify({
    chat: "Explain quantum computing in simple terms.",
    systemPrompt: "You are an expert physicist." // Optional
  })
});

const data = await response.json();
console.log(data.text);`} />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-lg p-4 z-50">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <p className="text-lg font-bold text-primary">
              <NumberFlow
                value={price}
                format={{
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 4,
                }}
              />
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
    </motion.div>
  );
}


