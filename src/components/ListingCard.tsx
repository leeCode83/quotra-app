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

  const modelTypeColors = {
    "text-generation": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "image-generation": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "embedding": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "speech": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "multimodal": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  } as const;

  const modelTypeLabel = {
    "text-generation": "Text Gen",
    "image-generation": "Image Gen",
    "embedding": "Embedding",
    "speech": "Speech",
    "multimodal": "Multimodal",
  } as const;

  type ModelType = keyof typeof modelTypeColors;

  function getModelTypeColor(type: string): string {
    return modelTypeColors[type as ModelType] ?? "";
  }

  function getModelTypeLabel(type: string): string {
    return modelTypeLabel[type as ModelType] ?? type;
  }

  return (
    <Card className={cn("h-full flex flex-col transition-shadow hover:shadow-md", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight line-clamp-2">{listing.name}</CardTitle>
          {listing.is_active ? (
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
          <Badge
            variant="outline"
            className={cn("text-xs", getModelTypeColor(listing.model_type))}
          >
            <Cpu className="h-3 w-3 mr-1" />
            {getModelTypeLabel(listing.model_type)}
          </Badge>
          <span className="text-sm font-semibold text-primary">
            {formatPrice(listing.price_per_request)}
          </span>
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
          <a href={listing.endpoint_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            API
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}