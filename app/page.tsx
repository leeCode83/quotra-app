import Link from "next/link";
import { ArrowRight, Cpu, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroSection } from "@/components/HeroSection";
import { createClient } from "@/lib/supabase-server";

const features = [
  {
    icon: Shield,
    title: "Escrow Protection",
    description:
      "On-chain escrow ensures providers get paid and consumers get what they pay for. No middlemen, no disputes.",
  },
  {
    icon: Cpu,
    title: "Direct API Access",
    description:
      "Connect directly to AI model endpoints. No rate-limiting intermediaries or vendor lock-in.",
  },
  {
    icon: Zap,
    title: "Instant Settlement",
    description:
      "Payments settle on Base in seconds. Low gas fees, high throughput, reliable execution.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, name, description, model_name, price_per_call_usdc, providers ( wallet_address )")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featuredListings = (listings ?? []).map((item: any) => {
    const wallet = item.providers?.[0]?.wallet_address;
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      modelName: item.model_name,
      pricePerCallUsdc: parseFloat(item.price_per_call_usdc || 0),
      providerWallet: wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Unknown",
    };
  });

  return (
    <>
      <HeroSection />

      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Why Quotra?</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            A decentralized marketplace where AI providers and consumers transact directly, secured by blockchain escrow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <CardHeader>
                <feature.icon className="h-10 w-10 mx-auto text-primary" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Featured Listings</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Discover top AI models available on the marketplace
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/marketplace">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {featuredListings.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-background">
            <Cpu className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Listings Yet</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
              Be the first to list an AI model on the marketplace.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/provider">List a Model</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredListings.map((listing) => (
              <Card key={listing.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{listing.name}</CardTitle>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Model
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">by {listing.providerWallet}</p>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
                  <p className="text-sm font-semibold text-primary mt-3">
                    {listing.pricePerCallUsdc === 0 ? "Free" : `${listing.pricePerCallUsdc.toFixed(4)} USDC/call`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-8 md:p-12 text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you&apos;re an AI provider looking to monetize your models or a consumer seeking affordable AI access, Quotra has you covered.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Button size="lg" asChild>
              <Link href="/dashboard/provider">
                Start as Provider
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard/consumer">
                Start as Consumer
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}