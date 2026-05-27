import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatEth(value: bigint | undefined, decimals = 4): string {
  if (!value) return "0";
  const divisor = 10n ** 18n;
  const whole = value / divisor;
  const fraction = value % divisor;
  const padded = fraction.toString().padStart(18, "0").slice(0, decimals);
  return `${whole}.${padded}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `${price.toFixed(4)} ETH`;
}