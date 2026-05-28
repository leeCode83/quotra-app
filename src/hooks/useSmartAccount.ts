"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useAccount, usePublicClient } from "wagmi"
import { http, createWalletClient, custom, type Hex, type WalletClient } from "viem"
import { baseSepolia } from "viem/chains"
import { createBundlerClient, type BundlerClient } from "viem/account-abstraction"
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation as createDelegationAction,
  type Delegation,
  type CreateDelegationOptions,
  type SignDelegationParams,
} from "@metamask/smart-accounts-kit"
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions"

const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY ?? ""}`

export interface DelegationEnvironment {
  account: NonNullable<Awaited<ReturnType<typeof toMetaMaskSmartAccount>>>
  client: NonNullable<BundlerClient>
  chain: typeof baseSepolia
}

export interface UseSmartAccountReturn {
  isConnected: boolean
  address: `0x${string}` | undefined
  smartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>> | null
  bundlerClient: BundlerClient | null
  permissionsWalletClient: WalletClient | null
  delegationEnvironment: DelegationEnvironment | null
  isLoadingSmartAccount: boolean
  smartAccountError: string | null
  createDelegation: (options: CreateDelegationOptions) => Delegation
  signDelegation: (params: SignDelegationParams) => Promise<`0x${string}`>
}

export function useSmartAccount(): UseSmartAccountReturn {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [smartAccount, setSmartAccount] = useState<Awaited<ReturnType<typeof toMetaMaskSmartAccount>> | null>(null)
  const [isLoadingSmartAccount, setIsLoadingSmartAccount] = useState(false)
  const [smartAccountError, setSmartAccountError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicClient || !address) {
      return
    }

    let cancelled = false

    const deploySalt = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}` as Hex

    toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [address, [], [], []],
      deploySalt,
    })
      .then((account) => {
        if (!cancelled) {
          setSmartAccount(account)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setSmartAccountError(err.message ?? "Failed to create smart account")
          setSmartAccount(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSmartAccount(false)
        }
      })

    Promise.resolve().then(() => {
      if (!cancelled) {
        setIsLoadingSmartAccount(true)
        setSmartAccountError(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [publicClient, address])

  const bundlerClient = useMemo(() => {
    return createBundlerClient({
      chain: baseSepolia,
      transport: http(PIMLICO_URL),
    })
  }, [])

  const permissionsWalletClient = useMemo(() => {
    if (typeof window === "undefined") return null
    const ethereum = (window as unknown as Record<string, unknown>).ethereum as
      | { request(...args: unknown[]): Promise<unknown> }
      | undefined
    if (!ethereum) return null
    return createWalletClient({
      chain: baseSepolia,
      transport: custom(ethereum),
    }).extend(erc7715ProviderActions())
  }, [])

  const delegationEnvironment = useMemo(() => {
    if (!smartAccount || !bundlerClient) return null
    return {
      account: smartAccount,
      client: bundlerClient,
      chain: baseSepolia,
    }
  }, [smartAccount, bundlerClient])

  const createDelegation = useCallback(
    (options: CreateDelegationOptions): Delegation => {
      return createDelegationAction(options)
    },
    []
  )

  const signDelegation = useCallback(
    async (params: SignDelegationParams): Promise<`0x${string}`> => {
      if (!smartAccount) {
        throw new Error("Smart account not initialized")
      }
      return smartAccount.signDelegation(params)
    },
    [smartAccount]
  )

  return {
    isConnected,
    address,
    smartAccount,
    bundlerClient,
    permissionsWalletClient,
    delegationEnvironment,
    isLoadingSmartAccount,
    smartAccountError,
    createDelegation,
    signDelegation,
  }
}
