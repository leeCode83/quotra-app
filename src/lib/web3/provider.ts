import { useAccount, useConnect, useDisconnect, useBalance, useChainId } from "wagmi";
import { baseSepolia } from "viem/chains";
import type { WalletSession } from "@/types";

export function useWallet() {
  const { address, isConnected, chain, chainId: connectedChainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const wagmiChainId = useChainId();
  const currentChainId = connectedChainId ?? wagmiChainId ?? baseSepolia.id;

  const session: WalletSession = {
    address: address ?? "",
    chainId: currentChainId,
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
