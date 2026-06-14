import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import crypto from "node:crypto"

const mockGetCode = vi.fn()
const mockGetTransactionCount = vi.fn()
const mockSignAuthorization = vi.fn().mockResolvedValue({
  address: "0x00000000000000000000000000000000000007702" as const,
  chainId: 84532,
  nonce: 5,
  r: "0x0000000000000000000000000000000000000000000000000000000000000001",
  s: "0x0000000000000000000000000000000000000000000000000000000000000001",
  yParity: 0,
})

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getCode: mockGetCode,
      getTransactionCount: mockGetTransactionCount,
    })),
    http: vi.fn(),
    privateKeyToAccount: vi.fn(() => ({
      address: "0xTreasuryEOAAddress000000000000000000000000",
      signAuthorization: mockSignAuthorization,
    })),
  }
})

vi.mock("@/lib/oneshot/client", () => ({
  getRelayerCapabilities: vi.fn(),
  estimateRelayerTransaction: vi.fn(),
  sendRelayerTransaction: vi.fn(),
}))

vi.mock("@metamask/smart-accounts-kit", () => ({
  toMetaMaskSmartAccount: vi.fn(),
  Implementation: { Stateless7702: "Stateless7702" },
  createDelegation: vi.fn(),
  getSmartAccountsEnvironment: vi.fn(),
  ScopeType: { Erc20TransferAmount: "erc20-token-amount" },
}))

import { claimViaPermissionlessRelayer } from "@/lib/oneshot/relayer-claim"
import {
  getRelayerCapabilities,
  estimateRelayerTransaction,
  sendRelayerTransaction,
} from "@/lib/oneshot/client"
import {
  toMetaMaskSmartAccount,
  createDelegation,
  getSmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit"

const mockProviderAddress = "0x3e6a2f0CBA03d293B54c9fCF354948903007a798" as `0x${string}`
const mockAmount = 20000n
const mockTaskId = "task-abc-123"

const mockCapabilities: Record<string, unknown> = {
  "84532": {
    targetAddress: "0x123456789abcdef0123456789abcdef01234567",
    feeCollector: "0xfeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    tokens: [
      { symbol: "USDC", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
    ],
  },
}

const mockEstimateSuccess: Record<string, unknown> = {
  success: true,
  requiredPaymentAmount: "0x38d7ea4c68000",
  context: "0xdeadbeef",
  gasUsed: {},
}

const mockDelegation: Record<string, unknown> = {
  delegate: "0x1234",
  delegator: "0x5678",
  authority: "0x",
  caveats: [],
  salt: "0xsalt",
}

const mockSmartAccount = {
  address: "0xSmartAccountAddress",
  environment: { chainId: 84532 },
  signDelegation: vi.fn().mockResolvedValue("0xsignature"),
}

describe("claimViaPermissionlessRelayer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TREASURY_PRIVATE_KEY =
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    vi.spyOn(crypto as unknown as { randomBytes: () => Buffer }, "randomBytes").mockReturnValue(Buffer.alloc(32, 0x42))

    mockGetCode.mockResolvedValue("0x1234")
    mockGetTransactionCount.mockResolvedValue(5)

    vi.mocked(getRelayerCapabilities).mockResolvedValue(mockCapabilities)
    vi.mocked(estimateRelayerTransaction).mockResolvedValue(mockEstimateSuccess)
    vi.mocked(sendRelayerTransaction).mockResolvedValue(mockTaskId)

    vi.mocked(toMetaMaskSmartAccount).mockResolvedValue(mockSmartAccount as never)
    vi.mocked(createDelegation).mockReturnValue(mockDelegation as never)

    vi.mocked(getSmartAccountsEnvironment).mockReturnValue({
      implementations: {
        EIP7702StatelessDeleGatorImpl: "0x00000000000000000000000000000000000007702",
      },
    } as never)
  })

  afterEach(() => {
    delete process.env.TREASURY_PRIVATE_KEY
    vi.restoreAllMocks()
  })

  it("throws if TREASURY_PRIVATE_KEY is not set", async () => {
    delete process.env.TREASURY_PRIVATE_KEY
    await expect(
      claimViaPermissionlessRelayer(mockProviderAddress, mockAmount),
    ).rejects.toThrow("TREASURY_PRIVATE_KEY must be set")
  })

  it("returns taskId on successful claim (no upgrade needed)", async () => {
    const result = await claimViaPermissionlessRelayer(mockProviderAddress, mockAmount)
    expect(result.taskId).toBe(mockTaskId)
  })

  it("includes authorizationList when treasury needs EIP-7702 upgrade", async () => {
    mockGetCode.mockResolvedValue("0x")

    await claimViaPermissionlessRelayer(mockProviderAddress, mockAmount)

    const params = vi.mocked(estimateRelayerTransaction).mock.calls[0][0] as Record<string, unknown>
    expect(params).toHaveProperty("authorizationList")
    const list = params.authorizationList as Array<Record<string, unknown>>
    expect(Array.isArray(list)).toBe(true)
    expect(list[0]).toHaveProperty("address")
    expect(list[0]).toHaveProperty("chainId")
    expect(list[0]).toHaveProperty("nonce")
    expect(list[0]).toHaveProperty("r")
    expect(list[0]).toHaveProperty("s")
    expect(list[0]).toHaveProperty("yParity")
  })

  it("handles fee adjustment when requiredPaymentAmount differs from mock fee", async () => {
    const differentFee: Record<string, unknown> = {
      success: true,
      requiredPaymentAmount: "0x456",
      context: "0xadjusted",
      gasUsed: {},
    }
    vi.mocked(estimateRelayerTransaction)
      .mockResolvedValueOnce(differentFee)
      .mockResolvedValueOnce(mockEstimateSuccess)

    await claimViaPermissionlessRelayer(mockProviderAddress, mockAmount)

    expect(vi.mocked(estimateRelayerTransaction)).toHaveBeenCalledTimes(2)
    const sendParams = vi.mocked(sendRelayerTransaction).mock.calls[0][0] as Record<string, unknown>
    expect(sendParams).toHaveProperty("context", "0xdeadbeef")
  })

  it("throws on estimate failure", async () => {
    vi.mocked(estimateRelayerTransaction).mockResolvedValue({
      success: false,
      error: "mock estimate error",
    })

    await expect(
      claimViaPermissionlessRelayer(mockProviderAddress, mockAmount),
    ).rejects.toThrow("mock estimate error")
  })

  it("throws on sendRelayerTransaction failure", async () => {
    vi.mocked(sendRelayerTransaction).mockRejectedValue(new Error("send failed"))

    await expect(
      claimViaPermissionlessRelayer(mockProviderAddress, mockAmount),
    ).rejects.toThrow("send failed")
  })

  it("calls getRelayerCapabilities with correct chainId", async () => {
    await claimViaPermissionlessRelayer(mockProviderAddress, mockAmount)

    expect(vi.mocked(getRelayerCapabilities)).toHaveBeenCalledWith(["84532"])
  })

  it("sends with destinationUrl when provided", async () => {
    const webhookUrl = "https://example.com/relayer-webhook"
    await claimViaPermissionlessRelayer(mockProviderAddress, mockAmount, webhookUrl)

    const params = vi.mocked(sendRelayerTransaction).mock.calls[0][0] as Record<string, unknown>
    expect(params).toHaveProperty("destinationUrl", webhookUrl)
  })

  it("includes memo in the send params", async () => {
    await claimViaPermissionlessRelayer(mockProviderAddress, mockAmount)

    const params = vi.mocked(sendRelayerTransaction).mock.calls[0][0] as Record<string, unknown>
    expect(params).toHaveProperty("memo")
    expect((params.memo as string)).toContain(mockProviderAddress)
  })
})
