"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Search, Filter, Grid3X3, List, Check, Clock, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListingCard } from "@/components/ListingCard";
import { GrantPermissionButton } from "@/components/GrantPermissionButton";
import { ConsumerTokenModal } from "@/components/ConsumerTokenModal";
const SERVER_ACCOUNT = (process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import type { Address } from "viem";
import type { ListingWithProvider } from "@/types";

const SORT_OPTIONS = ["newest", "oldest", "price-low", "price-high"] as const;

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [modalData, setModalData] = useState<{ open: boolean; jwt: string; endpoint: string; expiresAt: string } | null>(null);

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

  const [grantedListingIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const stored = localStorage.getItem("quotra_permissions");
    if (!stored) return new Set();
    try {
      const perms = JSON.parse(stored) as Array<{ listingId: string; jwt: string; expiresAt: string }>;
      const now = new Date().toISOString();
      const active = perms.filter((p) => p.expiresAt > now);
      return new Set(active.map((p) => p.listingId));
    } catch {
      return new Set();
    }
  });

  const handlePermissionGranted = useCallback(
    (listingId: string, delegationId: string | undefined, result: { jwt: string; expiresAt: string; permissionId?: string }) => {
      const stored = localStorage.getItem("quotra_permissions");
      const perms = stored ? JSON.parse(stored) : [];
      perms.push({ listingId, jwt: result.jwt, expiresAt: result.expiresAt });
      localStorage.setItem("quotra_permissions", JSON.stringify(perms));
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });

      // We need to infer delegation_id from the listing
      const endpoint = `${process.env.NEXT_PUBLIC_APP_URL || "https://quotra.app"}/api/v1/${delegationId || result.permissionId || "delegation-id"}/chat`;
      setModalData({
        open: true,
        jwt: result.jwt,
        endpoint,
        expiresAt: result.expiresAt
      });
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
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCard key={i} isLoading />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col md:flex-row rounded-2xl lg:rounded-3xl border border-foreground/10 overflow-hidden">
                <div className="flex flex-col gap-3 p-4 md:p-6 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-3 p-4 md:p-6 shrink-0 border-t md:border-t-0 md:border-l border-foreground/10">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            ))}
          </div>
        )
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
          {filteredListings.map((listing: ListingWithProvider) =>
            viewMode === "grid" ? (
              <div key={listing.id} className="h-full">
                <ListingCard listing={listing}>
                  {isConnected && (
                    grantedListingIds.has(listing.id) ? (
                      <Button size="lg" variant="outline" disabled className="w-full">
                        <Check className="h-4 w-4 mr-1" /> Granted
                      </Button>
                    ) : (
                      <div className="w-full [&>button]:w-full [&>button]:h-10">
                        <GrantPermissionButton
                          listingId={listing.id}
                          sessionAccountAddress={SERVER_ACCOUNT}
                          onSuccess={(result) => handlePermissionGranted(listing.id, listing.delegation_id ?? undefined, result)}
                        />
                      </div>
                    )
                  )}
                </ListingCard>
              </div>
            ) : (
              <div key={listing.id} className="flex flex-col md:flex-row relative rounded-2xl lg:rounded-3xl transition-all duration-300 bg-background items-stretch w-full border border-foreground/10 overflow-hidden hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 group">
                <div className="absolute top-1/2 inset-x-0 mx-auto h-12 -rotate-45 w-1/2 bg-primary/40 rounded-2xl lg:rounded-3xl blur-[8rem] -z-10" />

                <div className="flex flex-col justify-center gap-1.5 p-4 md:p-6 flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3 className="font-medium text-base md:text-lg text-foreground truncate" title={listing.name}>
                      {listing.name}
                    </h3>
                    <Badge variant={listing.status === "active" ? "success" : "secondary"} className="shrink-0 uppercase text-[10px] tracking-wider">
                      {listing.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${listing.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                    <span className="font-mono">{listing.provider?.wallet_address ? `${listing.provider.wallet_address.slice(0,6)}...${listing.provider.wallet_address.slice(-4)}` : "Unknown"}</span>
                    <span className="text-foreground/20">·</span>
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      {listing.model_name}
                    </span>
                  </div>

                  {listing.description && (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                      {listing.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{Number(listing.remaining_calls)} / {Number(listing.max_calls)} calls</span>
                    <span className="text-foreground/20">·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Exp {new Date(listing.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 p-4 md:p-6 shrink-0 border-t md:border-t-0 md:border-l border-foreground/10 md:min-w-[140px]">
                  <div className="flex items-baseline gap-1">
                    <NumberFlow
                      value={parseFloat(listing.price_per_call_usdc)}
                      format={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4,
                      }}
                      className="text-lg md:text-xl font-bold tracking-tight text-primary"
                    />
                    <span className="text-xs text-muted-foreground">/req</span>
                  </div>

                  {isConnected && (
                    <div className="w-full md:w-auto">
                      {grantedListingIds.has(listing.id) ? (
                        <Button size="sm" variant="outline" disabled className="w-full md:w-28 h-8 text-xs">
                          <Check className="h-3 w-3 mr-1" /> Granted
                        </Button>
                      ) : (
                        <div className="w-full [&>button]:w-full md:[&>button]:w-28 [&>button]:h-8 [&>button]:text-xs">
                          <GrantPermissionButton
                            listingId={listing.id}
                            sessionAccountAddress={SERVER_ACCOUNT}
                            onSuccess={(result) => handlePermissionGranted(listing.id, listing.delegation_id ?? undefined, result)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" className="flex-1 md:flex-none h-8 text-xs" asChild>
                      <Link href={`/marketplace/${listing.id}`}>View</Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1 md:flex-none h-8 text-xs" asChild>
                      <Link href={`/marketplace/${listing.id}`}>API</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {modalData && (
        <ConsumerTokenModal
          open={modalData.open}
          onOpenChange={(open) => setModalData(prev => prev ? { ...prev, open } : null)}
          jwt={modalData.jwt}
          endpoint={modalData.endpoint}
          expiresAt={modalData.expiresAt}
        />
      )}
    </div>
  );
}
