"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, AlertCircle, Check, Wallet, LogIn,
  FileKey, List, ArrowRight, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/lib/web3/provider";
import { useAuth } from "@/lib/web3/auth";
import { formatAddress } from "@/lib/utils";
import { EarningsPanel } from "@/components/EarningsPanel";
import { TransactionHistory } from "@/components/TransactionHistory";

const STEPS = ["Auth", "Registration & Listing", "Sign Delegation"] as const;

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

function StepIndicator({ current, steps }: { current: number; steps: readonly string[] }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            i === current
              ? "bg-primary text-primary-foreground"
              : i < current
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
          }`}>
            {i < current ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{s}</span>
          </div>
          {i < steps.length - 1 && <div className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

export default function ProviderDashboardPage() {
  const { session, isWrongChain, disconnect } = useWallet();
  const { token, isLoading: authLoading, login } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  
  const [form, setForm] = useState(emptyListingForm);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

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
      setStep(0);
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  }, [form, session.address, token, queryClient]);

  if (!session.isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Connect your wallet to access the provider dashboard and manage your AI model listings.
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
          Please switch to Base Sepolia testnet to use the provider dashboard.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => disconnect()}>
          Disconnect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your AI model listings</p>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {formatAddress(session.address)}
        </Badge>
      </div>

      {step > 0 && <StepIndicator current={step} steps={STEPS} />}

      {step === 0 && !provider && (
        <Card>
          <CardHeader>
            <CardTitle>Authenticate</CardTitle>
            <CardDescription>Sign a message to prove wallet ownership</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <LogIn className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Wallet Connected</p>
                <p className="text-xs text-muted-foreground">{formatAddress(session.address)}</p>
              </div>
              {token ? (
                <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Authenticated</Badge>
              ) : (
                <Button size="sm" onClick={login} disabled={authLoading}>
                  {authLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Sign In
                </Button>
              )}
            </div>
            {token && (
              <div className="flex justify-end">
                <Button onClick={() => setStep(1)} size="sm">
                  Register as Provider <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Register & Create Listing</CardTitle>
            <CardDescription>Register as a provider and setup your first AI model listing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Provider Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My AI Services" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="modelName">Model Name</Label>
                <Input id="modelName" value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} placeholder="gpt-4o-mini" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price per Call (USDC)</Label>
                <Input id="price" type="number" step="0.0001" value={form.pricePerCallUsdc} onChange={(e) => setForm({ ...form, pricePerCallUsdc: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxCalls">Max Calls</Label>
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
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            
            {registerError && (
              <p className="text-sm text-destructive">{registerError}</p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(0)} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!form.name || !form.modelName || !form.veniceApiKey}
                size="sm"
              >
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Sign Delegation</CardTitle>
            <CardDescription>
              Grant the Quotra escrow permission to manage USDC on your behalf (ERC-7715)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You will be prompted by your wallet to sign a delegation permission. This completes your registration and activates your listing.
            </p>
            {registerError && (
              <p className="text-sm text-destructive">{registerError}</p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleCombinedRegistration} disabled={registering} size="sm">
                {registering && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <FileKey className="h-4 w-4 mr-1" /> Sign & Register
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DASHBOARD CONTENT (if provider exists) */}
      {provider && step === 0 && (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
             <EarningsPanel 
               pendingEarnings={provider.pendingEarningsUsdc}
               totalEarned={provider.totalEarnedUsdc}
             />
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Listings</h2>
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                <Plus className="h-4 w-4 mr-1" /> New Listing
              </Button>
            </div>
            
            {dashboardLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="py-6"><div className="h-6 w-48 bg-muted rounded animate-pulse" /></CardContent></Card>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Listings Yet</h3>
                  <p className="text-muted-foreground mt-1">Create your first listing to get started.</p>
                  {token && (
                    <Button className="mt-4" onClick={() => setStep(1)}>
                      <Plus className="h-4 w-4 mr-2" /> Create Listing
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {listings.map((listing: Record<string, unknown> & { id: string, name: string, status: string, modelName: string, pricePerCallUsdc: number, remainingCalls: number, maxCalls: number }) => (
                  <Card key={listing.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{listing.name}</span>
                            <Badge variant={listing.status === "active" ? "success" : "secondary"} className="text-xs">
                              {listing.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {listing.modelName} &middot; ${listing.pricePerCallUsdc}/call &middot; {listing.remainingCalls}/{listing.maxCalls} left
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <TransactionHistory transactions={transactions} title="Provider Transactions" />
          </div>
        </div>
      )}
    </div>
  );
}
