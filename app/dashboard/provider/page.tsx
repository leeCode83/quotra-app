"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Eye, Trash2, Loader2, AlertCircle, ExternalLink,
  BarChart3, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWallet, useProviderAuth } from "@/lib/web3/provider";
import { formatAddress, formatPrice } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import type { Listing, ListingForm } from "@/types";

const emptyForm: ListingForm = {
  name: "", description: "", model_type: "text-generation",
  price_per_request: "", endpoint_url: "",
};

export default function ProviderDashboardPage() {
  const { session, isWrongChain, disconnect } = useWallet();
  useProviderAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ListingForm>(emptyForm);

  const { data: listings = [], isLoading, error } = useQuery<Listing[]>({
    queryKey: ["provider-listings"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("listings").select("*");
      if (error) throw error;
      return data;
    },
  });

  const toggleListingStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase.from("listings").update({ is_active: !isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-listings"] }),
  });

  const deleteListing = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-listings"] }),
  });

  const createListing = useMutation({
    mutationFn: async (formData: ListingForm) => {
      const supabase = createClient();
      const { error } = await supabase.from("listings").insert([
        {
          name: formData.name,
          description: formData.description || null,
          model_type: formData.model_type,
          price_per_request: parseFloat(formData.price_per_request) || 0,
          endpoint_url: formData.endpoint_url,
          is_active: true,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-listings"] });
      setForm(emptyForm);
      setDialogOpen(false);
    },
  });

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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Failed to Load Data</h2>
        <p className="text-muted-foreground mt-1">{(error as Error).message}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const activeListings = listings.filter((l) => l.is_active);
  const inactiveListings = listings.filter((l) => !l.is_active);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI model listings and track earnings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {formatAddress(session.address)}
          </Badge>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Listing
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Listing</DialogTitle>
                <DialogDescription>Add a new AI model endpoint to the marketplace.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My AI Model" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your model..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="model_type">Model Type</Label>
                  <Select value={form.model_type} onValueChange={(v) => setForm({ ...form, model_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text-generation">Text Generation</SelectItem>
                      <SelectItem value="image-generation">Image Generation</SelectItem>
                      <SelectItem value="embedding">Embedding</SelectItem>
                      <SelectItem value="speech">Speech</SelectItem>
                      <SelectItem value="multimodal">Multimodal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price per Request (ETH)</Label>
                  <Input id="price" type="number" step="0.0001" value={form.price_per_request} onChange={(e) => setForm({ ...form, price_per_request: e.target.value })} placeholder="0.001" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endpoint">Endpoint URL</Label>
                  <Input id="endpoint" value={form.endpoint_url} onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })} placeholder="https://api.example.com/v1/model" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createListing.mutate(form)} disabled={createListing.isPending || !form.name || !form.endpoint_url}>
                  {createListing.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Listing
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Listings</CardDescription>
            <CardTitle className="text-2xl">{listings.length}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{activeListings.length} active</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Listings</CardDescription>
            <CardTitle className="text-2xl">{activeListings.length}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">Visible to consumers</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Escrow Balance</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1">
              <BarChart3 className="h-5 w-5 text-primary" />
              0.00 ETH
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">Available for withdrawal</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active ({activeListings.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({inactiveListings.length})</TabsTrigger>
          <TabsTrigger value="all">All ({listings.length})</TabsTrigger>
        </TabsList>

        {(["active", "inactive", "all"] as const).map((tab) => {
          const tabListings = tab === "active" ? activeListings : tab === "inactive" ? inactiveListings : listings;
          return (
            <TabsContent key={tab} value={tab}>
              {tabListings.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No {tab} listings found.</p>
                    {tab === "active" && (
                      <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Create Your First Listing
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {tabListings.map((listing) => (
                    <Card key={listing.id}>
                      <CardContent className="py-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{listing.name}</h3>
                              <Badge variant={listing.is_active ? "success" : "secondary"} className="text-xs">
                                {listing.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{listing.model_type}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{listing.description}</p>
                            <p className="text-sm font-semibold text-primary mt-1">{formatPrice(listing.price_per_request)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => toggleListingStatus.mutate({ id: listing.id, isActive: listing.is_active })}>
                              {listing.is_active ? (
                                <><Eye className="h-4 w-4 mr-1" /> Deactivate</>
                              ) : (
                                <><Eye className="h-4 w-4 mr-1" /> Activate</>
                              )}
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={listing.endpoint_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" /> Endpoint
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteListing.mutate(listing.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
