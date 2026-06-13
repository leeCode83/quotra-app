"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NumberFlow from "@number-flow/react";
import {
  Plus, Loader2, Wallet,
  FileKey, List, Ban, Clock, Cpu, TrendingUp, Coins,
  ArrowRightLeft, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/web3/provider";
import { useWalletConnection } from "@/hooks/useWalletConnection";

import { cn, formatAddress } from "@/lib/utils";
import { TransactionHistory, Transaction } from "@/components/TransactionHistory";
import { useProviderClaim } from "@/hooks/useProviderClaim";
import { useDelegation } from "@/hooks/useDelegation";
import { apiClient } from "@/lib/api-client";

const DEFAULT_MODEL_MAP: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  google: "gemini-2.0-flash",
};

const emptyListingForm = {
  name: "",
  provider: "",
  modelName: "",
  pricePerCallUsdc: "0.001",
  maxCalls: 100,
  maxInputChars: 2000,
  maxCompletionTokens: 500,
  expiryDays: 30,
  apiKey: "",
};

export default function ProviderDashboardPage() {
  const { session, isWrongChain } = useWallet();
  const { connect, switchChain, isConnecting } = useWalletConnection();
  const queryClient = useQueryClient();
  
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [form, setForm] = useState(emptyListingForm);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { claim, isClaiming, claimStatus, error: claimError } = useProviderClaim();
  const { createProviderDelegation } = useDelegation();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["provider-dashboard", session.address],
    queryFn: async () => {
      const res = await apiClient("/api/providers/dashboard");
      if (!res.ok) {
        if (res.status === 404) return null; // No provider yet
        throw new Error("Failed to fetch dashboard");
      }
      return res.json();
    },
    enabled: session.isConnected && !!session.address && !isWrongChain,
  });

  const provider = dashboardData?.provider || null;
  const listings = dashboardData?.listings || [];
  const transactions = dashboardData?.transactions || [];
  const claims = dashboardData?.claims || [];
  const activeListingsCount = listings.filter((l: { status: string }) => l.status === "active").length;
  const pendingAmount = provider ? (typeof provider.pendingEarningsUsdc === "string" ? parseFloat(provider.pendingEarningsUsdc) : provider.pendingEarningsUsdc) : 0;
  const totalEarned = provider ? (typeof provider.totalEarnedUsdc === "string" ? parseFloat(provider.totalEarnedUsdc) : provider.totalEarnedUsdc) : 0;

  const handleCombinedRegistration = useCallback(async () => {
    setRegistering(true);
    setRegisterError(null);
    try {
      const configRes = await fetch("/api/providers/relayer-config");
      const configData = await configRes.json();
      if (!configData.success || !configData.config?.targetAddress) {
        throw new Error("Failed to fetch relayer config: " + (configData.error || "Missing targetAddress"));
      }

      const targetAddress = configData.config.targetAddress;
      const delegationResult = await createProviderDelegation(targetAddress);
      if (!delegationResult) {
        throw new Error("Delegation signing failed or was cancelled");
      }
      if ("error" in delegationResult) {
        throw new Error(`Delegation failed: ${delegationResult.error}`);
      }

      const payload = {
        walletAddress: session.address,
        name: form.name,
        apiKey: form.apiKey,
        modelName: form.provider + "/" + form.modelName,
        pricePerCallUsdc: Number(form.pricePerCallUsdc),
        maxCalls: form.maxCalls,
        maxInputChars: form.maxInputChars,
        maxCompletionTokens: form.maxCompletionTokens,
        expiryDays: form.expiryDays,
        delegationId: delegationResult.delegationId,
        permissionsContext: delegationResult.permissionsContext,
        delegationManager: delegationResult.delegationManager,
      };

      const res = await apiClient("/api/providers/listings", {
        method: "POST",
        body: JSON.stringify(payload, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        ),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Registration failed");
      }

      queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
      setForm(emptyListingForm);
      setIsCreatingListing(false);
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  }, [form, session.address, queryClient, createProviderDelegation]);

  const handleRevoke = async (listingId: string) => {
    setRevokingId(listingId);
    try {
      const res = await apiClient(`/api/listings/${listingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to revoke");
      }
      queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke listing");
    } finally {
      setRevokingId(null);
    }
  };

  const showAuthModal = !session.isConnected || isWrongChain;
  const isFirstTime = !dashboardLoading && !provider && !showAuthModal;

  const handleRegisterProvider = useCallback(async () => {
    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await apiClient("/api/providers", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  }, [session.address, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Listing Name</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Llama Instance" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="provider">Provider</Label>
          <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v, modelName: DEFAULT_MODEL_MAP[v] || form.modelName })}>
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="google">Google</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="modelName">Model Name</Label>
          <Input id="modelName" value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value.replace(/\s+/g, '') })} placeholder="e.g. gpt-4o-mini" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="price">Price per Call (USDC)</Label>
          <Input 
            id="price" 
            type="text" 
            inputMode="decimal"
            value={form.pricePerCallUsdc} 
            onChange={(e) => {
              const val = e.target.value.replace(/,/g, '.');
              if (/^\d*\.?\d*$/.test(val)) {
                setForm({ ...form, pricePerCallUsdc: val });
              }
            }} 
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maxCalls">Max Total Calls</Label>
          <Input id="maxCalls" type="number" value={form.maxCalls} onChange={(e) => setForm({ ...form, maxCalls: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="maxInputChars">Max Input Chars</Label>
          <Input id="maxInputChars" type="number" value={form.maxInputChars} onChange={(e) => setForm({ ...form, maxInputChars: Number(e.target.value) })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maxCompletionTokens">Max Completion Tokens</Label>
          <Input id="maxCompletionTokens" type="number" value={form.maxCompletionTokens} onChange={(e) => setForm({ ...form, maxCompletionTokens: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="expiryDays">Expiry (Days)</Label>
          <Select value={String(form.expiryDays)} onValueChange={(v) => setForm({ ...form, expiryDays: Number(v) })}>
            <SelectTrigger id="expiryDays">
              <SelectValue placeholder="Select expiry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="14">14 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
            </SelectContent>
          </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="apiKey">API KEY</Label>
        <Input id="apiKey" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." />
      </div>
      
      <p className="text-sm text-muted-foreground mt-4 border-t pt-4">
        You will be prompted by your wallet to sign a delegation permission. This completes your registration and activates your listing.
      </p>
      
      {registerError && (
        <p className="text-sm text-destructive font-medium">{registerError}</p>
      )}

      <div className="flex justify-end pt-2">
        <Button 
          onClick={handleCombinedRegistration} 
          disabled={registering || !form.name || !form.provider || !form.apiKey} 
          size="sm"
        >
          {registering && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <FileKey className="h-4 w-4 mr-1" /> Sign & Register
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-mesh-orb" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-mesh-orb-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-3xl animate-mesh-orb-slow" />
      </div>

      <div className="container mx-auto px-4 py-8 lg:py-12">
        {showAuthModal && (
          <div className="max-w-md mx-auto mt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Access Dashboard</h2>
              <p className="text-muted-foreground">
                {!session.isConnected
                  ? "Connect your wallet to access the provider dashboard."
                  : "Please switch to Base Sepolia testnet."}
              </p>
            </div>
            
            <Card className="border-foreground/10 bg-card/50 backdrop-blur-xl">
              <CardContent className="p-6 space-y-4">
                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    session.isConnected ? "border-success/30 bg-success/5" : "border-muted cursor-pointer hover:border-primary/50"
                  )}
                  onClick={() => !session.isConnected && connect()}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    session.isConnected ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                  )}>1</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Connect Wallet</p>
                    <p className="text-xs text-muted-foreground">
                      {session.isConnected ? formatAddress(session.address) : (isConnecting ? "Connecting..." : "Not connected")}
                    </p>
                  </div>
                  {session.isConnected && <Wallet className="h-4 w-4 text-success shrink-0" />}
                </div>

                <div 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    session.isConnected && !isWrongChain ? "border-success/30 bg-success/5" : (session.isConnected && isWrongChain ? "border-muted cursor-pointer hover:border-primary/50" : "border-muted opacity-50")
                  )}
                  onClick={() => isWrongChain && switchChain()}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    session.isConnected && !isWrongChain ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                  )}>2</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Base Sepolia Network</p>
                    <p className="text-xs text-muted-foreground">
                      {isWrongChain ? "Wrong network detected. Click to switch." : "Connected to Base Sepolia"}
                    </p>
                  </div>
                  {session.isConnected && !isWrongChain && <Cpu className="h-4 w-4 text-success shrink-0" />}
                </div>

                {!session.isConnected ? (
                  <Button className="w-full mt-2" onClick={() => connect()} disabled={isConnecting}>
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                    Connect Wallet
                  </Button>
                ) : isWrongChain ? (
                  <Button className="w-full mt-2" onClick={() => switchChain()}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Switch Network
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}

        {isFirstTime && (
          <div className="max-w-md mx-auto mt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Register as Provider</h2>
              <p className="text-muted-foreground">
                Create your provider account to start monetizing your AI API quotas on Quotra.
              </p>
            </div>

            <Card className="border-foreground/10 bg-card/50 backdrop-blur-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-success/30 bg-success/5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-success text-success-foreground">1</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Connect Wallet</p>
                    <p className="text-xs text-muted-foreground">{formatAddress(session.address)}</p>
                  </div>
                  <Wallet className="h-4 w-4 text-success shrink-0" />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-success/30 bg-success/5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-success text-success-foreground">2</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Base Sepolia Network</p>
                    <p className="text-xs text-muted-foreground">Connected to Base Sepolia</p>
                  </div>
                  <Cpu className="h-4 w-4 text-success shrink-0" />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-muted cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-primary text-primary-foreground">3</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Register Provider</p>
                    <p className="text-xs text-muted-foreground">
                      {registering ? "Registering..." : "Click to register your wallet as a provider"}
                    </p>
                  </div>
                  {!registering && <ArrowRightLeft className="h-4 w-4 text-primary shrink-0" />}
                </div>

                {registerError && (
                  <p className="text-sm text-destructive font-medium">{registerError}</p>
                )}

                <Button
                  onClick={handleRegisterProvider}
                  disabled={registering}
                  className="w-full mt-2"
                >
                  {registering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileKey className="h-4 w-4 mr-2" />}
                  Register as Provider
                </Button>
                
                <p className="text-xs text-muted-foreground text-center pt-2">
                  One-time registration. After this, you can create listings.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {!showAuthModal && provider && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-card/40 backdrop-blur-sm border border-foreground/10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shrink-0">
                <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-lg truncate">
                  {provider.name || "AI Provider"}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {formatAddress(session.address)}
                </p>
              </div>
              <Badge variant="outline" className="border-success/30 text-success bg-success/5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 inline-block animate-pulse" />
                Active
              </Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card/50 backdrop-blur-sm border-foreground/10 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    Pending Earnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <NumberFlow
                      value={pendingAmount}
                      format={{ style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 }}
                      className="text-2xl lg:text-3xl font-bold text-primary"
                      trend={pendingAmount > 0 ? 1 : 0}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-foreground/10 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    Lifetime Earned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <NumberFlow
                      value={totalEarned}
                      format={{ style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 }}
                      className="text-2xl lg:text-3xl font-bold"
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-foreground/10 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-primary" />
                    Active Listings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <NumberFlow
                      value={activeListingsCount}
                      className="text-2xl lg:text-3xl font-bold"
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-foreground/10 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <List className="h-3.5 w-3.5 text-primary" />
                    Total Listings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <NumberFlow
                      value={listings.length}
                      className="text-2xl lg:text-3xl font-bold"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-to-r from-primary/[0.04] to-transparent border-primary/10">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Pending Withdrawal</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingAmount > 0
                        ? `${Number(pendingAmount).toFixed(4)} USDC available to withdraw`
                        : "No pending earnings to withdraw"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {claimStatus === "success" && (
                    <span className="text-xs text-success font-medium">Withdrawn!</span>
                  )}
                  {claimError && (
                    <span className="text-xs text-destructive font-medium max-w-[200px] truncate">
                      {claimError}
                    </span>
                  )}
                  <Button
                    disabled={pendingAmount <= 0 || isClaiming}
                    onClick={async () => {
                      await claim();
                      queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
                    }}
                    size="sm"
                    className="shrink-0"
                  >
                    {isClaiming ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                    )}
                    {isClaiming ? "Withdrawing..." : "Withdraw"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="listings" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <TabsList className="bg-card/50 backdrop-blur-sm border border-foreground/10">
                  <TabsTrigger value="listings" className="data-[state=active]:bg-background">
                    <List className="h-4 w-4 mr-2" />
                    Listings
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="data-[state=active]:bg-background">
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Activity & Earnings
                  </TabsTrigger>
                </TabsList>
                <Button size="sm" onClick={() => setIsCreatingListing(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New Listing
                </Button>
              </div>

              <TabsContent value="listings" className="mt-0 space-y-4">
                {dashboardLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="bg-card/50 backdrop-blur-sm border-foreground/10">
                        <CardContent className="p-5 space-y-3">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-2 w-full" />
                          <div className="flex justify-between pt-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : listings.length === 0 ? (
                  <Card className="bg-card/50 backdrop-blur-sm border-foreground/10">
                    <CardContent className="py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <List className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Listings Yet</h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        You haven&apos;t created any active listings. Click &quot;New Listing&quot; to get started.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {listings.map((listing: { id: string, name: string, status: string, modelName: string, pricePerCallUsdc: number, remainingCalls: number, maxCalls: number, expiresAt: string | number | Date }) => {
                      const usedPercentage = Math.min(100, Math.max(0, ((listing.maxCalls - listing.remainingCalls) / listing.maxCalls) * 100));
                      const isActive = listing.status === "active";
                      const isExpired = listing.status === "expired" || new Date(listing.expiresAt) < new Date();

                      let badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "secondary";
                      let statusText = listing.status;

                      if (isActive && !isExpired) {
                        badgeVariant = "success";
                        statusText = "Active";
                      } else if (isExpired && listing.status !== "revoked") {
                        badgeVariant = "destructive";
                        statusText = "Expired";
                      }

                      return (
                        <Card
                          key={listing.id}
                          className="group bg-card/50 backdrop-blur-sm border-foreground/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
                        >
                          <CardContent className="p-5 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <h3 className="font-semibold truncate" title={listing.name}>{listing.name}</h3>
                                <div className="flex items-center gap-2">
                                  <Badge variant={badgeVariant} className="text-[10px] uppercase tracking-wider px-2 py-0">
                                    {statusText}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded truncate">
                                    {listing.modelName}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <NumberFlow
                                  value={listing.pricePerCallUsdc}
                                  format={{ style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 }}
                                  className="text-xl font-bold text-primary"
                                />
                                <p className="text-[10px] text-muted-foreground">/ call</p>
                              </div>
                            </div>

                            <div className="mt-auto space-y-3">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Quota</span>
                                  <span className="font-medium text-foreground">
                                    <NumberFlow value={listing.maxCalls - listing.remainingCalls} /> / <NumberFlow value={listing.maxCalls} />
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full transition-all duration-500 rounded-full",
                                      usedPercentage >= 90 ? "bg-destructive" : "bg-primary"
                                    )}
                                    style={{ width: `${usedPercentage}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-foreground/5 pt-3">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Expires {new Date(listing.expiresAt).toLocaleDateString()}
                                </span>

                                {isActive && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                  disabled={revokingId === listing.id}
                                >
                                  {revokingId === listing.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                                  Revoke
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to revoke this listing? This will immediately stop access for all consumers using it. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleRevoke(listing.id);
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Revoke Listing
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <Tabs defaultValue="earnings" className="space-y-4">
                  <TabsList className="bg-card/50 backdrop-blur-sm border border-foreground/10 w-full justify-start rounded-md h-auto p-1">
                    <TabsTrigger value="earnings" className="data-[state=active]:bg-background py-1.5 px-4 text-sm">Sales / Earnings</TabsTrigger>
                    <TabsTrigger value="withdrawals" className="data-[state=active]:bg-background py-1.5 px-4 text-sm">Withdrawal History</TabsTrigger>
                  </TabsList>
                  <TabsContent value="earnings" className="mt-0">
                    <TransactionHistory 
                      transactions={transactions.map((t: Transaction) => ({ ...t, type: 'income' as const }))} 
                      title="Sales History" 
                    />
                  </TabsContent>
                  <TabsContent value="withdrawals" className="mt-0">
                    <TransactionHistory 
                      transactions={claims.map((c: Transaction) => ({ ...c, type: 'income' as const }))} 
                      title="Withdrawals" 
                    />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <Dialog open={isCreatingListing} onOpenChange={setIsCreatingListing}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto border-foreground/10 bg-card/90 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>Create New Listing</DialogTitle>
              <DialogDescription>
                Set up your model access rules and pricing. Once submitted, you&apos;ll be prompted to sign the delegation.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {renderFormFields()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
