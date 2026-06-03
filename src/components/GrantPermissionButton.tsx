"use client"

import { useState } from "react"
import { createWalletClient, custom, parseEther, type Address } from "viem"
import { baseSepolia } from "viem/chains"
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions"
import { Button } from "@/components/ui/button"

declare global {
  interface Window {
    ethereum?: import("viem").EIP1193Provider
  }
}

interface GrantPermissionButtonProps {
  listingId: string
  sessionAccountAddress: Address
  onSuccess?: (result: { permissionId: string; expiresAt: string; jwt: string }) => void
}

export function GrantPermissionButton({
  listingId,
  sessionAccountAddress,
  onSuccess,
}: GrantPermissionButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGrantPermission = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed")
      }

      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
      }).extend(erc7715ProviderActions())

      const currentTime = Math.floor(Date.now() / 1000)
      const expiry = currentTime + 86400

      const grantedPermissions = await walletClient.requestExecutionPermissions([
        {
          chainId: 84532,
          to: sessionAccountAddress,
          expiry,
          permission: {
            type: "native-token-allowance",
            isAdjustmentAllowed: false,
            data: {
              allowanceAmount: parseEther("0.01"),
            },
          },
        },
      ])

      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          erc7715_proof: JSON.stringify(grantedPermissions),
          expires_at: new Date(expiry * 1000).toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `API returned ${res.status}`);
      }

      const data = await res.json();
      onSuccess?.({ permissionId: data.permissionId, expiresAt: data.expiresAt, jwt: data.consumerToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant permission")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <Button
        onClick={handleGrantPermission}
        disabled={isLoading}
        size="sm"
        className="w-full"
      >
        {isLoading ? "Granting..." : "Grant Permission"}
      </Button>
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  )
}
