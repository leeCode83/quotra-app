"use client";

import { cn } from "@/lib/utils";

interface CallsBarProps {
  used: number;
  total: number;
  className?: string;
}

export function CallsBar({ used, total, className }: CallsBarProps) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #a78bfa, #6d28d9)" }}
        />
      </div>
    </div>
  );
}
