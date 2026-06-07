import { encodeFunctionData } from "viem";

export type Delegation7710 = {
  delegate: `0x${string}`;
  delegator: `0x${string}`;
  authority: string;
  caveats: Array<{ enforcer: `0x${string}`; terms: string; args: string }>;
  salt: string;
  signature: string;
};

export type Execution7710 = {
  target: `0x${string}`;
  value: string;
  data: `0x${string}`;
};

export type DelegatedTransaction7710 = {
  permissionContext: Delegation7710[];
  executions: Execution7710[];
};

export function buildRelayerDelegation(
  delegationJson: Record<string, unknown>,
  signature: string
): Delegation7710 {
  // delegationJson should be the raw object from createDelegation
  // Need to ensure all BigInts or numbers that should be hex are hex strings
  // but since we receive it from the client, it is already JSON-ified.
  
  // The kit's toRelayerJson() usually handles this. If we get the JSON from the client,
  // we just need to ensure caveats have "args" field if it's missing.
  
  const d = delegationJson as Record<string, unknown>;
  
  return {
    delegate: d.delegate as `0x${string}`,
    delegator: d.delegator as `0x${string}`,
    authority: d.authority as string,
    caveats: ((d.caveats as Record<string, unknown>[]) || []).map((c: Record<string, unknown>) => ({
      enforcer: c.enforcer as `0x${string}`,
      terms: c.terms as string,
      args: (c.args as string) || "0x00",
    })),
    salt: d.salt as string,
    signature,
  };
}

export function buildFeeTransferExecution(
  feeCollector: `0x${string}`,
  usdcAddress: `0x${string}`,
  feeAmount: string | bigint
): Execution7710 {
  // Standard ERC-20 transfer ABI: transfer(address to, uint256 amount)
  const transferAbi = [
    {
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      name: "transfer",
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  const data = encodeFunctionData({
    abi: transferAbi,
    functionName: "transfer",
    args: [feeCollector, BigInt(feeAmount)],
  });

  return {
    target: usdcAddress,
    value: "0x0",
    data,
  };
}

export function buildRelayerBundle(
  delegation: Delegation7710,
  feeExecution: Execution7710,
  workExecutions: Execution7710[] = []
): DelegatedTransaction7710 {
  return {
    permissionContext: [delegation],
    executions: [feeExecution, ...workExecutions],
  };
}
