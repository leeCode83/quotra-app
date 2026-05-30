"use client";

import { useState, Suspense, lazy } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SplitText } from "@/components/animated/SplitText";
import { CountUp } from "@/components/animated/CountUp";

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);

const stats = [
  { label: "AI Models", value: 50, icon: Zap },
  { label: "Providers", value: 120, icon: Users },
  { label: "Escrow Protected", value: 100, icon: Shield, prefix: "100%" },
];

export function HeroSection() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section
      className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Suspense fallback={<div className="absolute inset-0 bg-muted/20" />}>
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-15 mix-blend-multiply dark:mix-blend-screen">
          <Dithering
            colorBack="#00000000"
            colorFront="#6d28d9"
            shape="warp"
            type="4x4"
            speed={isHovered ? 0.6 : 0.2}
            className="size-full"
            minPixelRatio={1}
          />
        </div>
      </Suspense>

      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none z-[1]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <SplitText
            text="Trade AI APIs Trustlessly"
            as="h1"
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.05]"
          />

          <p
            className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Connect AI providers with consumers through a peer-to-peer marketplace secured by
            on-chain escrow. No middlemen, no lock-in, just direct access to AI models.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              size="lg"
              className="shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-105 active:scale-95 hover:ring-4 hover:ring-primary/20"
              asChild
            >
              <Link href="/marketplace">
                Browse Marketplace
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="transition-all duration-300 hover:scale-105 active:scale-95 hover:ring-4 hover:ring-primary/20"
              asChild
            >
              <Link href="/dashboard/provider">
                Become a Provider
              </Link>
            </Button>
          </div>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20 max-w-2xl mx-auto"
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-sm"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-2xl md:text-3xl font-bold font-display">
                  {stat.prefix ? (
                    stat.prefix
                  ) : (
                    <CountUp to={stat.value} suffix="+" />
                  )}
                </span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
