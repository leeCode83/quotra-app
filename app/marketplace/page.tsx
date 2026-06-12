"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Search, Filter, Grid3X3, List, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListingCard } from "@/components/ListingCard";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import type { ListingWithProvider } from "@/types";

const SORT_OPTIONS = ["newest", "oldest", "price-low", "price-high"] as const;

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center rounded-2xl lg:rounded-3xl border border-foreground/10 overflow-hidden p-4 md:p-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");


  const { data: listings = [], isLoading, error } = useQuery<ListingWithProvider[]>({
    queryKey: ["marketplace-listings"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("listings").select("*, provider:providers(*)");
      if (error) throw error;
      return data as ListingWithProvider[];
    },
  });

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
          Discover AI model endpoints available for pay-per-call access
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
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
          <ListSkeleton />
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
                <ListingCard listing={listing} />
              </div>
            ) : (
              <div key={listing.id} className="flex items-center rounded-2xl lg:rounded-3xl border border-foreground/10 overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
                <div className="flex-1 p-4 md:p-6 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-base md:text-lg text-foreground truncate" title={listing.name}>
                      {listing.name}
                    </h3>
                    <span className={cn(
                      "block h-2.5 w-2.5 shrink-0 rounded-full animate-pulse",
                      listing.status === "active" ? "bg-green-500" : "bg-muted-foreground/50"
                    )} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <NumberFlow
                      value={parseFloat(listing.price_per_call_usdc)}
                      format={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4,
                      }}
                      className="text-xl font-bold tracking-tight text-primary"
                    />
                    <span className="text-xs text-muted-foreground">/req</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 md:p-6 shrink-0">
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{Number(listing.remaining_calls)} / {Number(listing.max_calls)}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                      <Link href={"/marketplace/" + listing.id}>Details</Link>
                    </Button>
                    {listing.delegation_id && (
                      <Button variant="secondary" size="sm" className="h-8 text-xs gap-1" asChild>
                        <Link href={"/playground/" + listing.id}>
                          <Beaker className="h-3 w-3" /> Try
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
