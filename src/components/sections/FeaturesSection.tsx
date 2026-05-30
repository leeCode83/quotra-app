"use client";

import { Reveal } from "@/components/animated/Reveal";
import { FeaturesShaderCards } from "@/components/ui/feature-shader-cards";

export function FeaturesSection() {
  return (
    <section className="relative py-16 md:py-20 overflow-hidden">
      <div className="container mx-auto px-4">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-3">
              Built for trustless
              <br />
              <span className="text-primary">AI commerce</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
              A decentralized marketplace where AI providers and consumers transact directly,
              secured by blockchain escrow.
            </p>
          </div>
        </Reveal>

        <FeaturesShaderCards />
      </div>
    </section>
  );
}
