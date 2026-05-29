"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface CountUpProps {
  from?: number;
  to: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
  decimals?: number;
}

export function CountUp({
  from = 0,
  to,
  suffix = "",
  prefix = "",
  className = "",
  duration = 2,
  decimals = 0,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const obj = { val: from };
      gsap.to(obj, {
        val: to,
        duration,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
        onUpdate: () => {
          el.textContent = `${prefix}${obj.val.toFixed(decimals)}${suffix}`;
        },
      });
    },
    { scope: ref }
  );

  return <span ref={ref} className={className}>{`${prefix}${from.toFixed(decimals)}${suffix}`}</span>;
}
