import { createPublicClient, http, encodeFunctionData, erc20Abi, parseUnits } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { bytesToHex } from "viem/utils"
import crypto from "node:crypto"
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  getSmartAccountsEnvironment,
  ScopeType,
} from "@metamask/smart-accounts-kit"
import {
  getRelayerCapabilities,
  estimateRelayerTransaction,
  sendRelayerTransaction,
} from "./client"
import { buildFeeTransferExecution } from "./relayer"
import { toRelayerJson } from "./to-relayer-json"

const CHAIN_ID = "84532"
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`

export interface ClaimViaRelayerResult {
  taskId: string
}

export async function claimViaPermissionlessRelayer(
  providerAddress: `0x${string}`,
  amountUsdc: bigint,
  webhookUrl?: string,
): Promise<ClaimViaRelayerResult> {
  const privateKey = process.env.TREASURY_PRIVATE_KEY
  if (!privateKey) {
    throw new Error("TREASURY_PRIVATE_KEY must be set")
  }

  const treasuryAccount = privateKeyToAccount(privateKey as `0x${string}`)
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })

  const capsResult = await getRelayerCapabilities([CHAIN_ID])
  const chainCaps = capsResult[CHAIN_ID]
  const targetAddress = chainCaps.targetAddress as `0x${string}`
  const feeCollector = chainCaps.feeCollector as `0x${string}`
  const usdcToken = chainCaps.tokens.find((t: { symbol: string }) => t.symbol === "USDC")!
  const usdcDecimals = Number(usdcToken.decimals)

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient as Parameters<typeof toMetaMaskSmartAccount>[0]['client'],
    implementation: Implementation.Stateless7702,
    address: treasuryAccount.address,
    signer: { account: treasuryAccount },
  })

  const code = await publicClient.getCode({ address: treasuryAccount.address })
  let authorizationList: unknown[] | undefined
  if (!code || code === "0x") {
    const environment = getSmartAccountsEnvironment(baseSepolia.id)
    const implAddress = environment.implementations.EIP7702StatelessDeleGatorImpl
    const nonce = await publicClient.getTransactionCount({
      address: treasuryAccount.address,
      blockTag: "pending",
    })
    const auth = await treasuryAccount.signAuthorization({
      chainId: baseSepolia.id,
      contractAddress: implAddress as `0x${string}`,
      nonce,
    })
    authorizationList = [{
      address: auth.address,
      chainId: auth.chainId,
      nonce: auth.nonce,
      r: auth.r,
      s: auth.s,
      yParity: auth.yParity ?? 0,
    }]
  }

  const salt = bytesToHex(crypto.randomBytes(32)) as `0x${string}`
  const mockFeeAmount = parseUnits("0.01", usdcDecimals)

  async function buildSignedBundle(feeAmount: bigint) {
    const delegation = createDelegation({
      to: targetAddress,
      from: smartAccount.address,
      environment: smartAccount.environment,
      salt,
      scope: {
        type: ScopeType.Erc20TransferAmount,
        tokenAddress: USDC_ADDRESS,
        maxAmount: amountUsdc + feeAmount,
      },
    })

    const signature = await smartAccount.signDelegation({ delegation })
    const signedDelegation = toRelayerJson({ ...delegation, signature })

    const feeExecution = buildFeeTransferExecution(feeCollector, USDC_ADDRESS, feeAmount)

    const workCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [providerAddress, amountUsdc],
    })

    const bundle = {
      permissionContext: [signedDelegation],
      executions: [feeExecution, { target: USDC_ADDRESS, value: "0x0", data: workCalldata }],
    }

    return {
      chainId: CHAIN_ID,
      ...(authorizationList ? { authorizationList } : {}),
      transactions: [toRelayerJson(bundle)],
    }
  }

  let sendParams = await buildSignedBundle(mockFeeAmount)
  let estimate = await estimateRelayerTransaction(sendParams as Record<string, unknown>)

  if (!estimate.success) {
    throw new Error(estimate.error ?? "estimate failed")
  }

  const requiredFee = BigInt(estimate.requiredPaymentAmount!)
  if (requiredFee !== mockFeeAmount) {
    sendParams = await buildSignedBundle(requiredFee)
    estimate = await estimateRelayerTransaction(sendParams as Record<string, unknown>)
    if (!estimate.success) {
      throw new Error(estimate.error ?? "re-estimate failed")
    }
  }

  const taskId = await sendRelayerTransaction({
    ...sendParams,
    context: estimate.context,
    ...(webhookUrl ? { destinationUrl: webhookUrl } : {}),
    memo: `claim-${providerAddress}-${amountUsdc.toString()}`,
  } as Record<string, unknown>)

  return { taskId }
}
