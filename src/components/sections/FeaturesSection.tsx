"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Reveal } from "@/components/animated/Reveal";
import { FeaturesShaderCards } from "@/components/ui/feature-shader-cards";

gsap.registerPlugin(ScrollTrigger);

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.fromTo(
        sectionRef.current.querySelectorAll(".shader-card"),
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            once: true,
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative py-16 md:py-20 overflow-hidden">
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
