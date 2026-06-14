import { encodeFunctionData } from "viem";

export type Execution7710 = {
  target: `0x${string}`;
  value: string;
  data: `0x${string}`;
};

export function buildFeeTransferExecution(
  feeCollector: `0x${string}`,
  usdcAddress: `0x${string}`,
  feeAmount: string | bigint
): Execution7710 {
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
