"use client";

import { useMemo } from "react";
import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { RequestExecutionPermissionsReturnType } from "@metamask/smart-accounts-kit/actions";
import { type LocalAccount } from "viem/accounts";

export function useX402WithDelegation(
  permissionContext: RequestExecutionPermissionsReturnType[0] | null,
  sessionAccount: LocalAccount | null
) {
  const fetchWithPayment = useMemo(() => {
    if (!permissionContext || !sessionAccount) return null;

    const erc7710Client = new x402Erc7710Client({
      delegationProvider: createx402DelegationProvider({
        account: sessionAccount,
        parentPermissionContext: permissionContext.context,
        from: permissionContext.from,
      }),
    });

    const coreClient = new x402Client().register('eip155:*', erc7710Client);
    const httpClient = new x402HTTPClient(coreClient);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return wrapFetchWithPayment(fetch, httpClient as any);
  }, [permissionContext, sessionAccount]);

  return { fetchWithPayment, isReady: !!fetchWithPayment };
}
