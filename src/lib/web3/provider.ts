import { useAccount, useConnect, useDisconnect, useBalance, useChainId } from "wagmi";
import { baseSepolia } from "viem/chains";
import type { WalletSession } from "@/types";

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const currentChainId = useChainId();

  const session: WalletSession = {
    address: address ?? "",
    chainId: currentChainId ?? baseSepolia.id,
    isConnected,
  };

  return {
    session,
    balance,
    chain,
    isWrongChain: currentChainId !== baseSepolia.id,
    connect,
    disconnect,
  };
}

export function useWalletAddress() {
  const { address, isConnected } = useAccount();
  return isConnected ? address : null;
}

export function useProviderAuth() {
  const address = useWalletAddress();
  return {
    isAuthenticated: !!address,
    providerAddress: address ?? null,
  };
}

export function useConsumerAuth() {
  const address = useWalletAddress();
  return {
    isAuthenticated: !!address,
    consumerAddress: address ?? null,
  };
}

export function useEscrow() {
  const address = useWalletAddress();
  return {
    escrowAddress: address ?? null,
  };
}
