"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GrantPermissionButton } from "@/components/GrantPermissionButton";
import { ConsumerTokenModal } from "@/components/ConsumerTokenModal";
import { createClient } from "@/lib/supabase-client";
import { formatPrice } from "@/lib/utils";
import type { ListingWithProvider } from "@/types";
import { useAccount } from "wagmi";
import type { Address } from "viem";

const SERVER_ACCOUNT = (process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isConnected } = useAccount();

  const [modalData, setModalData] = useState<{ open: boolean; jwt: string; endpoint: string; expiresAt: string } | null>(null);
  const [granted, setGranted] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("quotra_permissions");
      if (stored) {
        try {
          const perms = JSON.parse(stored);
          const active = perms.find((p: { listingId: string; expiresAt: string }) => p.listingId === id && p.expiresAt > new Date().toISOString());
          if (active) return true;
        } catch {}
      }
    }
    return false;
  });

  const { data: listing, isLoading, error } = useQuery<ListingWithProvider>({
    queryKey: ["listing", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("listings")
        .select("*, provider:providers(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ListingWithProvider;
    },
  });

  const handlePermissionGranted = (result: { jwt: string; expiresAt: string; permissionId?: string }) => {
    const stored = localStorage.getItem("quotra_permissions");
    const perms = stored ? JSON.parse(stored) : [];
    perms.push({ listingId: id, jwt: result.jwt, expiresAt: result.expiresAt });
    localStorage.setItem("quotra_permissions", JSON.stringify(perms));
    
    setGranted(true);

    const endpoint = `${process.env.NEXT_PUBLIC_APP_URL || "https://quotra.app"}/api/v1/${listing?.delegation_id || result.permissionId || "delegation-id"}/chat`;
    setModalData({
      open: true,
      jwt: result.jwt,
      endpoint,
      expiresAt: result.expiresAt
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4 max-w-3xl mx-auto">
          <div className="h-8 w-24 bg-muted rounded mb-8" />
          <div className="h-12 w-3/4 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
          <div className="h-64 bg-muted rounded mt-8" />
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold text-destructive">Listing not found</h2>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/marketplace">Back to Marketplace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-6 pl-0" asChild>
          <Link href="/marketplace">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Marketplace
          </Link>
        </Button>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{listing.name}</h1>
                <Badge variant={listing.status === "active" ? "success" : "secondary"}>
                  {listing.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Provided by {listing.provider?.name || listing.provider?.wallet_address}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{listing.description || "No description provided."}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Details</CardTitle>
                <CardDescription>Gateway and parameter specifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Model Name</p>
                    <p className="font-mono mt-1">{listing.model_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Gateway Base URL</p>
                    <p className="font-mono mt-1 text-sm break-all">
                       {process.env.NEXT_PUBLIC_APP_URL || "https://quotra.app"}/api/v1/{listing.delegation_id || "{delegation_id}"}/chat
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Max Input Chars</p>
                    <p className="mt-1">{listing.max_input_chars}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Max Completion Tokens</p>
                    <p className="mt-1">{listing.max_completion_tokens}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Purchase Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-3xl font-bold text-primary">
                    ${formatPrice(parseFloat(listing.price_per_call_usdc))}
                  </p>
                  <p className="text-sm text-muted-foreground">per request (USDC)</p>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining Calls</span>
                    <span className="font-medium">{listing.remaining_calls} / {listing.max_calls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span className="font-medium">{new Date(listing.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  {!isConnected ? (
                    <Button className="w-full" disabled>Connect Wallet to Purchase</Button>
                  ) : granted ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Check className="h-4 w-4 mr-2" /> Access Granted
                    </Button>
                  ) : listing.status !== "active" ? (
                    <Button className="w-full" disabled>Listing Inactive</Button>
                  ) : (
                    <GrantPermissionButton
                      listingId={listing.id}
                      sessionAccountAddress={SERVER_ACCOUNT}
                      onSuccess={handlePermissionGranted}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
