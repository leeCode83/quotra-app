import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const ESCROW_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const escrowAbi = [
  { inputs: [], name: "Deposit", type: "event" },
  { inputs: [], name: "Withdraw", type: "event" },
  { inputs: [], name: "Lock", type: "event" },
  { inputs: [], name: "Unlock", type: "event" },
  {
    inputs: [
      { name: "provider", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "provider", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "provider", type: "address" }],
    name: "getEscrowStats",
    outputs: [{ name: "", type: "uint256" }, { name: "", type: "uint256" }, { name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export async function depositToEscrow(provider: `0x${string}`, amount: bigint) {
  const hash = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
  return { hash, provider, amount };
}

export async function getEscrowBalance(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _provider: `0x${string}`
): Promise<bigint> {
  return BigInt(0);
}

function getServerWalletClient() {
  const pk = process.env.ADMIN_PRIVATE_KEY;
  if (!pk) {
    throw new Error("ADMIN_PRIVATE_KEY environment variable is not set");
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

export async function withdrawFromEscrow(
  providerAddress: `0x${string}`,
  amount: number,
): Promise<`0x${string}`> {
  const walletClient = getServerWalletClient();
  const amountWei = parseEther(amount.toString());
  const hash = await walletClient.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "withdraw",
    args: [providerAddress, amountWei],
  });
  return hash;
}
