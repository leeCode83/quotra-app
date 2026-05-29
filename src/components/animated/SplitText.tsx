"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface SplitTextProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
  stagger?: number;
  wordClassName?: string;
}

export function SplitText({
  text,
  className = "",
  as: Tag = "h1",
  delay = 0,
  stagger = 0.04,
  wordClassName = "",
}: SplitTextProps) {
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const words = container.current?.querySelectorAll(".split-word");
      if (!words?.length) return;
      gsap.fromTo(
        words,
        { y: 40, opacity: 0, rotateX: -15 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.8,
          delay,
          stagger,
          ease: "power4.out",
        }
      );
    },
    { scope: container }
  );

  const words = text.split(" ");

  return (
    <Tag className={className} ref={container as never} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className={`split-word inline-block ${wordClassName}`}>
          {word}
          {i < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </Tag>
  );
}
