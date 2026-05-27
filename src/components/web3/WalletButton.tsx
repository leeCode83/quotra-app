"use client";

import { useState, useRef, useEffect } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_EXPLORER_URL } from "@/lib/web3/config";
import {
  Wallet,
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  AlertTriangle,
} from "lucide-react";

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const {
    address,
    isConnected,
    isConnecting,
    isWrongChain,
    connect,
    disconnect,
    switchChain,
  } = useWalletConnection();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setIsDropdownOpen(false);
  };

  const handleViewOnExplorer = () => {
    if (!address) return;
    window.open(`${BASE_SEPOLIA_EXPLORER_URL}/address/${address}`, "_blank");
    setIsDropdownOpen(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
  };

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </span>
        <span className="sm:hidden">Connect</span>
      </button>
    );
  }

  if (isWrongChain) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm font-medium text-red-700 dark:text-red-400 hidden sm:inline">
          Wrong Network
        </span>
        <button
          onClick={switchChain}
          className="text-xs font-medium text-red-600 dark:text-red-400 underline hover:no-underline ml-1"
        >
          Switch
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        {/* Network indicator dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </span>

        {/* Avatar placeholder */}
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Wallet className="h-3.5 w-3.5 text-zinc-500" />
        </div>

        <span className="font-mono text-xs sm:text-sm">
          {truncateAddress(address ?? "")}
        </span>

        <ChevronDown
          className={`h-4 w-4 text-zinc-400 transition-transform ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Connected to</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {baseSepolia.name}
              </span>
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={handleCopyAddress}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy Address"}
            </button>

            <button
              onClick={handleViewOnExplorer}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View on Explorer
            </button>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 py-1">
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
