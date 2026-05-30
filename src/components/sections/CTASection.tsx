"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-cyan-500/[0.05] p-8 md:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 rounded-3xl p-[1px] pointer-events-none">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/40 via-cyan-500/30 to-primary/40 animate-border-shimmer" />
          </div>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative space-y-6 cta-item">
            <h2 className="text-3xl md:text-4xl font-display font-bold">
              Ready to get started?
            </h2>
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto cta-item">
            Whether you&apos;re an AI provider looking to monetize your models or a consumer
            seeking affordable AI access, Quotra has you covered.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2 cta-item">
            <Button size="lg" asChild>
              <Link href="/dashboard/provider">Start as Provider</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard/consumer">Start as Consumer</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
