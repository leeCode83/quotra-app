"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

export type WalletConnectionError =
  | "NO_METAMASK"
  | "USER_REJECTED"
  | "SWITCH_CHAIN_FAILED"
  | "CONNECTION_FAILED"
  | null;

export interface WalletConnectionState {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isWrongChain: boolean;
  chainId: number | undefined;
  balance: { formatted: string; symbol: string } | null;
  error: WalletConnectionError;
  errorMessage: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
}

function getErrorMessage(error: WalletConnectionError): string {
  switch (error) {
    case "NO_METAMASK":
      return "MetaMask not detected. Please install MetaMask to continue.";
    case "USER_REJECTED":
      return "Connection rejected. Please approve the connection in your wallet.";
    case "SWITCH_CHAIN_FAILED":
      return "Failed to switch network. Please manually switch to Base Sepolia in MetaMask.";
    case "CONNECTION_FAILED":
      return "Failed to connect wallet. Please try again.";
    default:
      return "";
  }
}

function detectMetaMask(): boolean {
  if (typeof window === "undefined") return false;
  const ethereum = (window as unknown as Record<string, unknown>).ethereum;
  if (!ethereum) return false;
  const isMetaMask =
    typeof ethereum === "object" &&
    ethereum !== null &&
    "isMetaMask" in ethereum &&
    ethereum.isMetaMask === true;
  return isMetaMask;
}

export function useWalletConnection(): WalletConnectionState {
  const { address, isConnected, isConnecting: wagmiIsConnecting, chainId: connectedChainId } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address });
  const wagmiChainId = useChainId();
  const chainId = connectedChainId ?? wagmiChainId;
  const { switchChainAsync } = useSwitchChain();

  const [error, setError] = useState<WalletConnectionError>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const isWrongChain = chainId !== undefined && chainId !== baseSepolia.id;

  const connect = useCallback(async () => {
    setError(null);

    if (!detectMetaMask()) {
      setError("NO_METAMASK");
      return;
    }

    try {
      await connectAsync({ connector: injected() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("rejected") || message.includes("denied")) {
        setError("USER_REJECTED");
      } else {
        setError("CONNECTION_FAILED");
      }
    }
  }, [connectAsync]);

  const switchChain = useCallback(async () => {
    setError(null);
    setIsSwitching(true);

    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: baseSepolia.id });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("rejected") || message.includes("denied")) {
        setError("USER_REJECTED");
      } else {
        setError("SWITCH_CHAIN_FAILED");
      }
    } finally {
      setIsSwitching(false);
    }
  }, [switchChainAsync]);

  useEffect(() => {
    if (isConnected && isWrongChain) {
      // Optionally auto-prompt for chain switch
      // switchChain();
    }
  }, [isConnected, isWrongChain]);

  return {
    address,
    isConnected,
    isConnecting: wagmiIsConnecting || isSwitching,
    isWrongChain,
    chainId,
    balance: balanceData
      ? { formatted: formatUnits(balanceData.value, balanceData.decimals), symbol: balanceData.symbol }
      : null,
    error,
    errorMessage: getErrorMessage(error),
    connect,
    disconnect,
    switchChain,
  };
}
