"use client";

import { useRef } from "react";

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
  wordClassName = "",
}: SplitTextProps) {
  const container = useRef<HTMLElement>(null);
  const words = text.split(" ");

  return (
    <Tag className={className} ref={container as never} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className={`inline-block ${wordClassName}`}>
          {word}
          {i < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </Tag>
  );
}
