"use client";

import React from "react";
import Link from "next/link";
import { Eye, Beaker, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import type { ListingWithProvider } from "@/types";

interface ListingCardProps {
  listing?: ListingWithProvider;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  children?: React.ReactNode;
}

function CallsBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #a78bfa, #6d28d9)" }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground mt-2 block">
        {used} / {total} calls
      </span>
    </div>
  );
}

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    typeof date === "string" ? new Date(date) : date
  );
}

function ListingCardSkeleton() {
  return (
    <div className="flex flex-col relative rounded-2xl lg:rounded-3xl transition-all bg-background items-start w-full border border-foreground/10 overflow-hidden h-full">
      <div className="p-4 md:p-8 flex rounded-t-2xl lg:rounded-t-3xl flex-col items-start w-full relative">
        <Skeleton className="h-10 w-1/2 mt-5" />
        <Skeleton className="h-6 w-3/4 mt-3" />
      </div>
      <div className="flex flex-col items-start w-full px-4 md:px-8 py-2">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div className="flex flex-col items-start w-full p-4 md:p-6 gap-y-2">
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function ListingCardError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 rounded-2xl lg:rounded-3xl border border-destructive/50">
      <AlertCircle className="h-8 w-8 text-destructive mb-3" />
      <p className="text-sm text-center text-destructive">{message}</p>
    </div>
  );
}

export function ListingCard({ listing, isLoading, error, className, children }: ListingCardProps) {
  if (isLoading) return <ListingCardSkeleton />;
  if (error) return <ListingCardError message={error} />;
  if (!listing) return null;

  const isActive = listing.status === "active";
  const isExpired = listing.status === "expired" || new Date(listing.expires_at) < new Date();

  let statusText = listing.status;
  if (isActive && !isExpired) statusText = "Active";
  else if (isExpired && listing.status !== "revoked") statusText = "Expired";

  const price = parseFloat(listing.price_per_call_usdc?.toString() || "0");

  return (
    <div className={cn(
        "flex flex-col relative rounded-2xl lg:rounded-3xl transition-all bg-background items-start w-full border border-foreground/10 overflow-hidden h-full",
        className
    )}>
        <div className="absolute top-1/2 inset-x-0 mx-auto h-12 -rotate-45 w-full bg-primary/40 rounded-2xl lg:rounded-3xl blur-[8rem] -z-10"></div>

        <div className="p-4 md:p-6 lg:p-8 flex rounded-t-2xl lg:rounded-t-3xl flex-col items-start w-full relative">
            <div className="absolute top-4 right-4 md:top-6 md:right-6 lg:top-8 lg:right-8">
                <span className={cn(
                    "block h-3 w-3 rounded-full animate-pulse",
                    statusText === "Active" ? "bg-green-500" : "bg-muted-foreground/50"
                )} />
            </div>
            <h3 className="text-4xl font-bold md:text-5xl tracking-tight text-primary">
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
            </h3>

            <div className="mt-4">
                <h2 className="font-medium text-xl text-foreground line-clamp-1" title={listing.name}>
                    {listing.name}
                </h2>
                <Badge variant="secondary" className="mt-2 text-xs font-normal">
                    {listing.model_name}
                </Badge>
            </div>
        </div>

        <div className="w-full px-4 md:px-8">
          <div className="flex items-center justify-end text-xs text-muted-foreground border-t border-foreground/10 pt-4 mt-2">
            <span>Exp: {formatDate(listing.expires_at)}</span>
          </div>
        </div>

        <div className="flex flex-col items-start w-full px-4 py-2 md:px-8 space-y-3 mt-auto">
            {children ? (
                <div className="w-full">
                    {children}
                </div>
            ) : null}

            <div className="w-full flex flex-col gap-2">
                <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/marketplace/${listing.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                    </Link>
                </Button>
                <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link href={`/playground/${listing.id}`}>
                        <Beaker className="h-4 w-4 mr-1" />
                        Playground
                    </Link>
                </Button>
            </div>
        </div>

        <div className="flex flex-col items-start w-full p-4 md:p-6 gap-y-3">
          <CallsBar used={Number(listing.remaining_calls)} total={Number(listing.max_calls)} />
        </div>
    </div>
  );
}
