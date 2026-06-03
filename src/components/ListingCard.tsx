"use client";

import React from "react";
import Link from "next/link";
import { CheckIcon, ExternalLink, Eye, AlertCircle } from "lucide-react";
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

function ListingCardSkeleton() {
  return (
    <div className="flex flex-col relative rounded-2xl lg:rounded-3xl transition-all bg-background items-start w-full border border-foreground/10 overflow-hidden h-full">
      <div className="p-4 md:p-8 flex rounded-t-2xl lg:rounded-t-3xl flex-col items-start w-full relative">
        <Skeleton className="h-6 w-3/4 mt-5" />
        <Skeleton className="h-10 w-1/2 mt-3" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-2/3 mt-2" />
      </div>
      <div className="flex flex-col items-start w-full px-4 md:px-8 py-2">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div className="flex flex-col items-start w-full p-5 mb-4 ml-1 gap-y-2">
        <Skeleton className="h-4 w-1/3 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
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

  const features = [
    `Access to ${listing.model_name}`,
    `Provider: ${listing.provider?.wallet_address.slice(0, 6)}...${listing.provider?.wallet_address.slice(-4)}`,
    `${listing.remaining_calls} / ${listing.max_calls} calls left`,
    `Max ${listing.max_input_chars} input chars`,
    `Max ${listing.max_completion_tokens} completion tokens`,
    `Expires: ${new Date(listing.expires_at).toLocaleDateString()}`
  ];

  return (
    <div className={cn(
        "flex flex-col relative rounded-2xl lg:rounded-3xl transition-all bg-background items-start w-full border border-foreground/10 overflow-hidden h-full",
        className
    )}>
        {/* Glow effect for ALL listings as requested by user */}
        <div className="absolute top-1/2 inset-x-0 mx-auto h-12 -rotate-45 w-full bg-primary/40 rounded-2xl lg:rounded-3xl blur-[8rem] -z-10"></div>

        <div className="p-4 md:p-6 lg:p-8 flex rounded-t-2xl lg:rounded-t-3xl flex-col items-start w-full relative">
            <div className="flex items-start justify-between w-full pt-2">
                <h2 className="font-medium text-xl text-foreground line-clamp-2" title={listing.name}>
                    {listing.name}
                </h2>
                <Badge variant={statusText === "Active" ? "success" : "secondary"} className="shrink-0 ml-2 uppercase text-[10px] tracking-wider">
                    {statusText}
                </Badge>
            </div>
            
            <h3 className="mt-4 text-3xl font-bold md:text-5xl tracking-tight text-primary">
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
            
            {listing.description && (
                <p className="text-sm md:text-base text-muted-foreground mt-4 line-clamp-2">
                    {listing.description}
                </p>
            )}
        </div>
        
        {/* Actions section */}
        <div className="flex flex-col items-start w-full px-4 py-2 md:px-8 space-y-3 mt-auto">
            {children ? (
                // If caller provided a button (e.g., Grant Permission), show it here
                <div className="w-full">
                    {children}
                </div>
            ) : null}
            
            <div className="flex w-full gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/marketplace/${listing.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                    </Link>
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" asChild>
                    <Link href={`/marketplace/${listing.id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        API
                    </Link>
                </Button>
            </div>
        </div>

        {/* Features list */}
        <div className="flex flex-col items-start w-full p-4 md:p-6 mb-2 ml-1 gap-y-3">
            <span className="text-sm font-medium text-left mb-1 text-muted-foreground">
                Listing Specifications: 
            </span>
            {features.map((feature, index) => (
                <div key={index} className="flex items-start justify-start gap-3">
                    <div className="flex items-center justify-center shrink-0 mt-0.5 bg-primary/10 p-1 rounded-full">
                        <CheckIcon className="size-3 text-primary" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-foreground/90">{feature}</span>
                </div>
            ))}
        </div>
    </div>
  );
}
