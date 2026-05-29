"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { ArrowRight, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/animated/Reveal";

gsap.registerPlugin(ScrollTrigger);

interface Listing {
  id: string;
  name: string;
  description: string;
  modelName: string;
  pricePerCallUsdc: number;
  providerWallet: string;
}

interface ListingsSectionProps {
  listings: Listing[];
}

export function ListingsSection({ listings }: ListingsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);

  useGSAP(
    () => {
      const cards = cardsRef.current.filter(Boolean);
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { y: 40, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative py-24 md:py-32 overflow-hidden">
      <div className="container mx-auto px-4">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">
                Featured Listings
              </h2>
              <p className="text-muted-foreground">
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
        </Reveal>

        {listings.length === 0 ? (
          <Reveal>
            <div className="text-center py-16 md:py-20 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent">
              <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                <Cpu className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Listings Yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Be the first to list an AI model on the marketplace.
              </p>
              <Button asChild>
                <Link href="/dashboard/provider">List a Model</Link>
              </Button>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((listing, i) => (
              <div
                key={listing.id}
                ref={(el) => { if (el) cardsRef.current[i] = el; }}
              >
                <Card className="group relative h-full border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] hover:border-primary/30 transition-colors duration-300">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <CardHeader className="pb-3 relative">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-tight font-semibold">
                        {listing.name}
                      </CardTitle>
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full shrink-0">
                        {listing.modelName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      by {listing.providerWallet}
                    </p>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {listing.description}
                    </p>
                    <p className="text-sm font-semibold text-primary mt-3">
                      {listing.pricePerCallUsdc === 0
                        ? "Free"
                        : `${listing.pricePerCallUsdc.toFixed(4)} USDC/call`}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
