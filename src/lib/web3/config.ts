/**
 * Web3 Configuration for Quotra on Base Sepolia Testnet
 * @module web3/config
 */

import { createConfig, cookieStorage, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "viem/chains";

// Base Sepolia constants
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;
export const BASE_SEPOLIA_EXPLORER_URL = "https://sepolia.basescan.org" as const;

// Environment variables with fallbacks for graceful handling
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

if (!projectId) {
  console.warn(
    "[Web3 Config] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set. WalletConnect features may be unavailable."
  );
}

if (!process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) {
  console.warn(
    "[Web3 Config] NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL not set. Using default Base Sepolia RPC."
  );
}

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(rpcUrl),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

export function getChainId(): typeof BASE_SEPOLIA_CHAIN_ID {
  return BASE_SEPOLIA_CHAIN_ID;
}

export function getExplorerUrl(txHash: string): string {
  return `${BASE_SEPOLIA_EXPLORER_URL}/tx/${txHash}`;
}

export function getSenderAddress(receipt: { from: `0x${string}` }): `0x${string}` {
  return receipt.from;
}
