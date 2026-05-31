"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, AlertCircle, Wallet, LogIn,
  FileKey, List, Ban
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/lib/web3/provider";
import { useAuth } from "@/lib/web3/auth";
import { formatAddress } from "@/lib/utils";
import { EarningsPanel } from "@/components/EarningsPanel";
import { TransactionHistory } from "@/components/TransactionHistory";
import { useProviderClaim } from "@/hooks/useProviderClaim";

const emptyListingForm = {
  name: "",
  modelName: "",
  pricePerCallUsdc: 0.001,
  maxCalls: 100,
  maxInputChars: 2000,
  maxCompletionTokens: 500,
  expiryDays: 30,
  veniceApiKey: "",
};

export default function ProviderDashboardPage() {
  const { session, isWrongChain, disconnect } = useWallet();
  const { token, isLoading: authLoading, login } = useAuth();
  const queryClient = useQueryClient();
  
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [form, setForm] = useState(emptyListingForm);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { claim } = useProviderClaim();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["provider-dashboard", token],
    queryFn: async () => {
      const res = await fetch("/api/provider/dashboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (res.status === 404) return null; // No provider yet
        throw new Error("Failed to fetch dashboard");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const provider = dashboardData?.provider || null;
  const listings = dashboardData?.listings || [];
  const transactions = dashboardData?.transactions || [];
  const activeListingsCount = listings.filter((l: { status: string }) => l.status === "active").length;

  const handleCombinedRegistration = useCallback(async () => {
    if (!window.ethereum) {
      setRegisterError("MetaMask not detected");
      return;
    }
    
    setRegistering(true);
    setRegisterError(null);
    try {
      // Sign Delegation First
      const currentTime = Math.floor(Date.now() / 1000);
      const delegationMessage = JSON.stringify({
        type: "erc7710",
        delegator: session.address,
        delegate: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "",
        chainId: 84532,
        expiry: currentTime + 86400 * form.expiryDays,
        issuedAt: currentTime,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signature: string = await (window.ethereum.request as any)({
        method: "personal_sign",
        params: [delegationMessage, session.address],
      });

      const delegationId = `del_${session.address.toLowerCase()}_${currentTime}`;
      const signedDelegation = { message: delegationMessage, signature };

      // Submit Combined Payload
      const payload = {
        walletAddress: session.address,
        veniceApiKey: form.veniceApiKey,
        modelName: form.modelName,
        pricePerCallUsdc: form.pricePerCallUsdc,
        maxCalls: form.maxCalls,
        maxInputChars: form.maxInputChars,
        maxCompletionTokens: form.maxCompletionTokens,
        expiryDays: form.expiryDays,
        delegationId,
        signedDelegation,
        name: form.name,
      };

      const res = await fetch("/api/provider/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
  }, [form, session.address, token, queryClient]);

  const handleRevoke = async (listingId: string) => {
    if (!confirm("Are you sure you want to revoke this listing? This will immediately stop access for all consumers using it.")) return;
    
    setRevokingId(listingId);
    try {
      const res = await fetch(`/api/provider/listing/${listingId}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
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

  const showAuthModal = !session.isConnected || isWrongChain || !token;
  const isFirstTime = !dashboardLoading && !provider && !showAuthModal;

  const renderFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Listing Name</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Llama Instance" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="modelName">Model Name</Label>
          <select 
            id="modelName"
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={form.modelName}
            onChange={(e) => setForm({ ...form, modelName: e.target.value })}
          >
            <option value="" disabled>Select a model</option>
            <option value="llama-3.3-70b">Llama 3.3 70B</option>
            <option value="deepseek-r1-llama-70b">DeepSeek R1 (Llama 70B)</option>
            <option value="deepseek-v4-pro">DeepSeek v4 Pro</option>
            <option value="qwen-3.6">Qwen 3.6</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="price">Price per Call (USDC)</Label>
          <Input id="price" type="number" step="0.0001" value={form.pricePerCallUsdc} onChange={(e) => setForm({ ...form, pricePerCallUsdc: Number(e.target.value) })} />
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
        <select 
          id="expiryDays"
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={form.expiryDays}
          onChange={(e) => setForm({ ...form, expiryDays: Number(e.target.value) })}
        >
          <option value={7}>7 Days</option>
          <option value={14}>14 Days</option>
          <option value={30}>30 Days</option>
          <option value={90}>90 Days</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="veniceApiKey">Venice AI API Key</Label>
        <Input id="veniceApiKey" type="password" value={form.veniceApiKey} onChange={(e) => setForm({ ...form, veniceApiKey: e.target.value })} placeholder="sk-..." />
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
          disabled={registering || !form.name || !form.modelName || !form.veniceApiKey} 
          size="sm"
        >
          {registering && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <FileKey className="h-4 w-4 mr-1" /> Sign & Register
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Dialog open={showAuthModal}>
        <DialogContent 
          className="sm:max-w-md [&>button]:hidden" 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {!session.isConnected ? "Connect Your Wallet" : isWrongChain ? "Wrong Network" : "Authenticate"}
            </DialogTitle>
            <DialogDescription>
              {!session.isConnected 
                ? "Connect your wallet to access the provider dashboard."
                : isWrongChain 
                ? "Please switch to Base Sepolia testnet."
                : "Sign a message to prove wallet ownership."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            {!session.isConnected ? (
              <Wallet className="h-12 w-12 text-muted-foreground mb-2" />
            ) : isWrongChain ? (
              <AlertCircle className="h-12 w-12 text-destructive mb-2" />
            ) : (
              <LogIn className="h-12 w-12 text-muted-foreground mb-2" />
            )}
            
            {!session.isConnected ? (
              <p className="text-sm text-center text-muted-foreground">
                Please use the wallet connect button in the navigation bar to connect.
              </p>
            ) : isWrongChain ? (
              <Button variant="outline" onClick={() => disconnect()}>
                Disconnect Wallet
              </Button>
            ) : (
              <div className="w-full flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">Wallet Connected</p>
                  <p className="text-xs text-muted-foreground">{formatAddress(session.address)}</p>
                </div>
                <Button size="sm" onClick={login} disabled={authLoading}>
                  {authLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your AI model listings and earnings</p>
        </div>
        {session.isConnected && (
          <Badge variant="outline" className="font-mono text-xs py-1">
            {formatAddress(session.address)}
          </Badge>
        )}
      </div>

      {isFirstTime && (
        <Card className="max-w-2xl mx-auto mt-12 border-dashed border-2">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Become a Quotra Provider</CardTitle>
            <CardDescription className="text-base">
              Monetize your unused AI API quotas by listing them on the decentralized marketplace. 
              No credit card needed, get paid in USDC per call.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-6">
             <Button size="lg" onClick={() => setIsCreatingListing(true)} className="w-full sm:w-auto">
               <Plus className="h-5 w-5 mr-2" />
               Create Your First Listing
             </Button>
          </CardContent>
        </Card>
      )}

      {!showAuthModal && provider && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             <EarningsPanel 
               pendingEarnings={provider.pendingEarningsUsdc}
               totalEarned={provider.totalEarnedUsdc}
               onWithdraw={async () => {
                 await claim();
                 queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
               }}
             />
             <Card className="shadow-sm border-muted">
               <CardHeader className="pb-2">
                 <CardTitle className="text-xl">Active Listings</CardTitle>
                 <CardDescription>Number of models currently providing access</CardDescription>
               </CardHeader>
               <CardContent className="py-4">
                  <div className="text-3xl font-bold text-foreground">
                    {activeListingsCount}
                  </div>
               </CardContent>
             </Card>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Listings</h2>
              <Button size="sm" onClick={() => setIsCreatingListing(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Listing
              </Button>
            </div>
            
            {dashboardLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="py-6"><div className="h-6 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <List className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold">No Listings Yet</h3>
                  <p className="text-muted-foreground mt-1 text-sm">You haven&apos;t created any active listings.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {listings.map((listing: { id: string, name: string, status: string, modelName: string, pricePerCallUsdc: number, remainingCalls: number, maxCalls: number, expiresAt: string | number | Date }) => {
                  const usedPercentage = Math.min(100, Math.max(0, ((listing.maxCalls - listing.remainingCalls) / listing.maxCalls) * 100));
                  const isActive = listing.status === "active";
                  const isExpired = listing.status === "expired" || new Date(listing.expiresAt) < new Date();
                  
                  let badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" = "secondary";
                  let statusText = listing.status;
                  
                  if (isActive && !isExpired) {
                    badgeVariant = "success";
                    statusText = "Active";
                  } else if (isExpired && listing.status !== "revoked") {
                    badgeVariant = "destructive";
                    statusText = "Expired";
                  }

                  return (
                  <Card key={listing.id} className="flex flex-col border-muted shadow-sm">
                    <CardContent className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg line-clamp-1" title={listing.name}>{listing.name}</h3>
                          <Badge variant={badgeVariant} className="text-[10px] uppercase tracking-wider">{statusText}</Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-primary">${listing.pricePerCallUsdc}</span>
                          <span className="text-xs text-muted-foreground block">/ call</span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-4">
                        <span className="inline-block bg-muted px-2 py-0.5 rounded text-xs font-mono">{listing.modelName}</span>
                      </div>

                      <div className="mt-auto space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Quota Usage</span>
                            <span className="font-medium">{listing.maxCalls - listing.remainingCalls} / {listing.maxCalls}</span>
                          </div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${usedPercentage >= 90 ? 'bg-destructive' : 'bg-primary'}`} 
                              style={{ width: `${usedPercentage}%` }} 
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                          <span>Expires: {new Date(listing.expiresAt).toLocaleDateString()}</span>
                          
                          {isActive && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                              onClick={() => handleRevoke(listing.id)}
                              disabled={revokingId === listing.id}
                            >
                              {revokingId === listing.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )})}
              </div>
            )}
          </div>

          <div className="mt-8">
            <TransactionHistory transactions={transactions} title="Recent Activity" />
          </div>
        </div>
      )}

      {/* New Listing Modal */}
      <Dialog open={isCreatingListing} onOpenChange={setIsCreatingListing}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
  );
}
