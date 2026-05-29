"use client";

import Link from "next/link";
import { Cpu, ExternalLink, Eye } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPrice } from "@/lib/utils";
import type { ListingWithProvider } from "@/types";

interface ListingCardProps {
  listing?: ListingWithProvider;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

function ListingCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}

function ListingCardError({ message }: { message: string }) {
  return (
    <Card className="h-full border-destructive/50">
      <CardContent className="py-8 text-center">
        <p className="text-sm text-destructive">{message}</p>
      </CardContent>
    </Card>
  );
}

export function ListingCard({ listing, isLoading, error, className }: ListingCardProps) {
  if (isLoading) {
    return <ListingCardSkeleton />;
  }

  if (error) {
    return <ListingCardError message={error} />;
  }

  if (!listing) {
    return null;
  }

  return (
    <Card className={cn("h-full flex flex-col transition-shadow hover:shadow-md", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight line-clamp-2">{listing.name}</CardTitle>
          {listing.status === "active" ? (
            <Badge variant="success" className="shrink-0">Active</Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">Inactive</Badge>
          )}
        </div>
        {listing.provider && (
          <p className="text-xs text-muted-foreground mt-1">
            by {listing.provider.name}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {listing.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Cpu className="h-3 w-3 mr-1" />
            {listing.model_name}
          </Badge>
          <span className="text-sm font-semibold text-primary">
            ${formatPrice(parseFloat(listing.price_per_call_usdc))}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{listing.remaining_calls}/{listing.max_calls} calls left</span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link href={`/marketplace?listing=${listing.id}`}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Link>
        </Button>
        <Button size="sm" className="flex-1" asChild>
          <Link href={`/marketplace?listing=${listing.id}`}>
            <ExternalLink className="h-4 w-4 mr-1" />
            API
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
