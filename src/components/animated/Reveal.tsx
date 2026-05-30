"use client";

import { type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
  once?: boolean;
}

export function Reveal({
  children,
  className = "",
}: RevealProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
