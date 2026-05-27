"use client";

import Link from "next/link";
import { ArrowRight, Shield, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "AI Models", value: "50+", icon: Zap },
  { label: "Providers", value: "120+", icon: Users },
  { label: "Escrow Protected", value: "100%", icon: Shield },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
      <div className="container mx-auto px-4 py-20 md:py-32 relative">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" />
            <span>Decentralized AI Marketplace on Base</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Trade AI APIs
            <span className="block text-primary">Trustlessly</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect AI providers with consumers through a peer-to-peer marketplace secured by
            on-chain escrow. No middlemen, no lock-in, just direct access to AI models.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link href="/marketplace">
                Browse Marketplace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard/provider">
                Become a Provider
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-2xl mx-auto">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card">
              <stat.icon className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}