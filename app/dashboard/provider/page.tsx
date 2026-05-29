"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, AlertCircle, Check, Wallet, LogIn, UserPlus,
  FileKey, List, ArrowRight, ArrowLeft, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/lib/web3/provider";
import { useAuth } from "@/lib/web3/auth";
import { formatAddress } from "@/lib/utils";
import type { Listing, Provider } from "@/types";

const STEPS = ["Auth", "Register", "Delegation", "Create Listing"] as const;
type Step = (typeof STEPS)[number];

const emptyListingForm = {
  name: "",
  description: "",
  model_name: "",
  price_per_call_usdc: "",
  max_calls: 100,
  max_input_chars: 2000,
  max_completion_tokens: 500,
  expires_at: "",
  api_key: "",
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
  const { session, isWrongChain, disconnect, connect } = useWallet();
  const { token, isLoading: authLoading, login, logout } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [providerData, setProviderData] = useState<Provider | null>(null);
  const [regName, setRegName] = useState("");
  const [delegation, setDelegation] = useState<{ id: string; signed: Record<string, unknown> } | null>(null);
  const [delegating, setDelegating] = useState(false);
  const [delegationError, setDelegationError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyListingForm);
  const [encrypted, setEncrypted] = useState<{
    encrypted_key: string;
    key_iv: string;
    key_auth_tag: string;
  } | null>(null);
  const [encrypting, setEncrypting] = useState(false);

  const { data: listings = [], isLoading: listLoading } = useQuery<Listing[]>({
    queryKey: ["provider-listings", token],
    queryFn: async () => {
      const res = await fetch("/api/providers/me/listings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch listings");
      const data = await res.json();
      return data.listings ?? [];
    },
    enabled: !!token,
  });

  const registerMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/providers/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ wallet_address: session.address, name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Registration failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setStep(2);
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider_id: providerData!.id,
          name: form.name,
          description: form.description,
          model_name: form.model_name,
          price_per_call_usdc: form.price_per_call_usdc,
          max_calls: form.max_calls,
          max_input_chars: form.max_input_chars,
          max_completion_tokens: form.max_completion_tokens,
          expires_at: form.expires_at,
          delegation_id: delegation!.id,
          signed_delegation: delegation!.signed,
          encrypted_key: encrypted!.encrypted_key,
          key_iv: encrypted!.key_iv,
          key_auth_tag: encrypted!.key_auth_tag,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create listing");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-listings"] });
      setForm(emptyListingForm);
      setEncrypted(null);
      setStep(0);
    },
  });

  const handleEncrypt = async () => {
    if (!form.api_key) return;
    setEncrypting(true);
    try {
      const res = await fetch("/api/listings/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: form.api_key }),
      });
      if (!res.ok) throw new Error("Encryption failed");
      const data = await res.json();
      setEncrypted(data);
    } catch (err) {
      console.error("Encrypt error:", err);
    } finally {
      setEncrypting(false);
    }
  };

  const handleSignDelegation = useCallback(async () => {
    if (!window.ethereum) {
      setDelegationError("MetaMask not detected");
      return;
    }
    setDelegating(true);
    setDelegationError(null);
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const delegationMessage = JSON.stringify({
        type: "erc7710",
        delegator: session.address,
        delegate: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "",
        chainId: 84532,
        expiry: currentTime + 86400 * 30,
        issuedAt: currentTime,
      });

      const signature: string = await window.ethereum.request({
        method: "personal_sign",
        params: [delegationMessage, session.address],
      } as any);

      setDelegation({
        id: `del_${session.address.toLowerCase()}_${currentTime}`,
        signed: { message: delegationMessage, signature } as unknown as Record<string, unknown>,
      });
      setStep(3);
    } catch (err) {
      setDelegationError(err instanceof Error ? err.message : "Delegation signing failed");
    } finally {
      setDelegating(false);
    }
  }, [session.address]);

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

      <StepIndicator current={step} steps={STEPS} />

      {step === 0 && (
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
                <Button onClick={() => { setStep(1); setProviderData(null); }} size="sm">
                  Continue <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Register Provider</CardTitle>
            <CardDescription>Register as a provider on the Quotra marketplace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="regName">Provider Name</Label>
              <Input
                id="regName"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="My AI Services"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => registerMutation.mutate(regName)}
                disabled={registerMutation.isPending || regName.length < 3}
                size="sm"
              >
                {registerMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <UserPlus className="h-4 w-4 mr-1" /> Register
              </Button>
            </div>
            {registerMutation.isError && (
              <p className="text-sm text-destructive">{(registerMutation.error as Error).message}</p>
            )}
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
            {delegation ? (
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="font-medium">Delegation signed</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{delegation.id}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You will be prompted by your wallet to sign a delegation permission.
              </p>
            )}
            {delegationError && (
              <p className="text-sm text-destructive">{delegationError}</p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {!delegation ? (
                <Button onClick={handleSignDelegation} disabled={delegating} size="sm">
                  {delegating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <FileKey className="h-4 w-4 mr-1" /> Sign Delegation
                </Button>
              ) : (
                <Button onClick={() => setStep(3)} size="sm">
                  Continue <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Create Listing</CardTitle>
            <CardDescription>Add a new AI model to the marketplace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="GPT-4o Mini" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model_name">Model Name</Label>
                <Input id="model_name" value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} placeholder="gpt-4o-mini" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your model..." className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price per Call (USDC)</Label>
                <Input id="price" type="number" step="0.0001" value={form.price_per_call_usdc} onChange={(e) => setForm({ ...form, price_per_call_usdc: e.target.value })} placeholder="0.001" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_calls">Max Calls</Label>
                <Input id="max_calls" type="number" value={form.max_calls} onChange={(e) => setForm({ ...form, max_calls: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="max_input_chars">Max Input Chars</Label>
                <Input id="max_input_chars" type="number" value={form.max_input_chars} onChange={(e) => setForm({ ...form, max_input_chars: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_completion_tokens">Max Completion Tokens</Label>
                <Input id="max_completion_tokens" type="number" value={form.max_completion_tokens} onChange={(e) => setForm({ ...form, max_completion_tokens: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expires_at">Expires At</Label>
              <Input id="expires_at" type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="api_key">API Key</Label>
              <div className="flex gap-2">
                <Input id="api_key" type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." />
                {!encrypted ? (
                  <Button variant="outline" onClick={handleEncrypt} disabled={encrypting || !form.api_key}>
                    {encrypting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Encrypt"}
                  </Button>
                ) : (
                  <Badge variant="success" className="px-3"><Check className="h-4 w-4 mr-1" /> Encrypted</Badge>
                )}
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => createListingMutation.mutate()}
                disabled={createListingMutation.isPending || !form.name || !form.model_name || !form.price_per_call_usdc || !form.expires_at || !encrypted || !delegation}
                size="sm"
              >
                {createListingMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Plus className="h-4 w-4 mr-1" /> Create Listing
              </Button>
            </div>
            {createListingMutation.isError && (
              <p className="text-sm text-destructive">{(createListingMutation.error as Error).message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Listings</h2>
          {token && (
            <Button size="sm" variant="outline" onClick={() => setStep(1)}>
              <Plus className="h-4 w-4 mr-1" /> New Listing
            </Button>
          )}
        </div>
        {listLoading ? (
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
            {listings.map((listing) => (
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
                        {listing.model_name} &middot; ${listing.price_per_call_usdc}/call &middot; {listing.remaining_calls}/{listing.max_calls} left
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
