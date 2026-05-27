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
