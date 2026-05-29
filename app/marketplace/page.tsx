"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Search, Filter, Grid3X3, List, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListingCard } from "@/components/ListingCard";
import { GrantPermissionButton } from "@/components/GrantPermissionButton";
const SERVER_ACCOUNT = (process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
import { cn, formatPrice } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import type { Address } from "viem";
import type { ListingWithProvider } from "@/types";

const SORT_OPTIONS = ["newest", "oldest", "price-low", "price-high"] as const;

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { isConnected } = useAccount();
  const queryClient = useQueryClient();

  const { data: listings = [], isLoading, error } = useQuery<ListingWithProvider[]>({
    queryKey: ["marketplace-listings"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("listings").select("*, provider:providers(*)");
      if (error) throw error;
      return data as ListingWithProvider[];
    },
  });

  const grantedListingIds = useMemo(() => {
    if (typeof window === "undefined") return new Set<string>();
    const stored = localStorage.getItem("quotra_permissions");
    if (!stored) return new Set<string>();
    try {
      const perms = JSON.parse(stored) as Array<{ listingId: string; jwt: string; expiresAt: string }>;
      const now = new Date().toISOString();
      const active = perms.filter((p) => p.expiresAt > now);
      return new Set(active.map((p) => p.listingId));
    } catch {
      return new Set<string>();
    }
  }, [isConnected]);

  const handlePermissionGranted = useCallback(
    (listingId: string, result: { jwt: string; expiresAt: string }) => {
      const stored = localStorage.getItem("quotra_permissions");
      const perms = stored ? JSON.parse(stored) : [];
      perms.push({ listingId, jwt: result.jwt, expiresAt: result.expiresAt });
      localStorage.setItem("quotra_permissions", JSON.stringify(perms));
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
    },
    [queryClient]
  );

  const filteredListings = useMemo(() => {
    let result = [...listings];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.description?.toLowerCase().includes(q) ?? false) ||
          l.model_name.toLowerCase().includes(q) ||
          (l.provider?.wallet_address.toLowerCase().includes(q) ?? false)
      );
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "price-low":
        result.sort((a, b) => Number(a.price_per_call_usdc) - Number(b.price_per_call_usdc));
        break;
      case "price-high":
        result.sort((a, b) => Number(b.price_per_call_usdc) - Number(a.price_per_call_usdc));
        break;
    }

    return result;
  }, [search, sortBy, listings]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground mt-1">
          Browse and discover AI model endpoints available for direct access
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models, providers, types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt === "newest" ? "Newest First" : opt === "oldest" ? "Oldest First" : opt === "price-low" ? "Price: Low to High" : "Price: High to Low"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListingCard key={i} isLoading />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{(error as Error).message}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filteredListings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No listings found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filteredListings.length > 0 && (
        <div className={cn(
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            : "flex flex-col gap-4"
        )}>
          {filteredListings.map((listing) =>
            viewMode === "grid" ? (
              <div key={listing.id} className="flex flex-col gap-2">
                <ListingCard listing={listing} />
                {isConnected && (
                  grantedListingIds.has(listing.id) ? (
                    <Button size="sm" variant="outline" disabled>
                      <Check className="h-4 w-4 mr-1" /> Granted
                    </Button>
                  ) : (
                    <GrantPermissionButton
                      listingId={listing.id}
                      sessionAccountAddress={SERVER_ACCOUNT}
                      onSuccess={(result) => handlePermissionGranted(listing.id, result)}
                    />
                  )
                )}
              </div>
            ) : (
              <Card key={listing.id} className="flex flex-col md:flex-row md:items-center">
                <CardHeader className="pb-2 md:pb-0 md:flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{listing.name}</CardTitle>
                    {listing.status === "active" ? (
                      <Badge variant="success" className="text-xs">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {listing.provider?.wallet_address ? `${listing.provider.wallet_address.slice(0,6)}...${listing.provider.wallet_address.slice(-4)}` : "Unknown"} · {listing.model_name}
                  </p>
                </CardHeader>
                <CardContent className="md:w-48 md:text-right">
                  <p className="font-semibold text-primary">{formatPrice(parseFloat(listing.price_per_call_usdc))}</p>
                  <p className="text-xs text-muted-foreground">per request</p>
                  {isConnected && (
                    <div className="mt-2">
                      {grantedListingIds.has(listing.id) ? (
                        <Button size="sm" variant="outline" disabled className="w-full">
                          <Check className="h-4 w-4 mr-1" /> Granted
                        </Button>
                      ) : (
                        <GrantPermissionButton
                          listingId={listing.id}
                          sessionAccountAddress={SERVER_ACCOUNT}
                          onSuccess={(result) => handlePermissionGranted(listing.id, result)}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
