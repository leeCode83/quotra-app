# Fix: allowanceAmount 0n → 1n

## Problem
`InvalidInputRpcError: Invalid allowanceAmount: must be greater than 0`
RPC validation rejects `0n`. Minimum valid: `1n`.

## Change (1 line)
File: `src/hooks/usePermissions.ts:103`

```diff
- allowanceAmount: 0n,
+ allowanceAmount: 1n,
```

1 wei = 0.000000000000000001 ETH — effectively zero, session auth only.

## Verification
- `npx tsc --noEmit` — typecheck
- `npx vitest run src/lib/__tests__/usePermissions.test.ts` — 4 tests
