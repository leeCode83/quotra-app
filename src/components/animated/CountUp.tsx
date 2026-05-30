"use client";

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
  to,
  suffix = "",
  prefix = "",
  className = "",
  decimals = 0,
}: CountUpProps) {
  return <span className={className}>{`${prefix}${to.toFixed(decimals)}${suffix}`}</span>;
}
