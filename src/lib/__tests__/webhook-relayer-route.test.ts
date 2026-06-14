import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { verifyRelayerWebhook } from "@/lib/oneshot"
import { POST } from "../../../app/api/webhooks/relayer/route"

const mockSupabase = {
  from: vi.fn(),
}

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock("@/lib/oneshot", () => ({
  verifyRelayerWebhook: vi.fn(),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/relayer", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("API /webhooks/relayer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyRelayerWebhook).mockResolvedValue(true)
  })

  it("returns 400 on invalid body (missing apiVersion)", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Invalid relayer webhook payload")
  })

  it("returns 400 on missing data.id", async () => {
    const res = await POST(makeRequest({ apiVersion: 0, type: 4, data: {} }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Invalid relayer webhook payload")
  })

  it("type 4 stores tx_hash when hash present", async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.from.mockReturnValue({ update: mockUpdate, eq: mockEq })

    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 4,
        data: { id: "task-1", status: 110, hash: "0xabc" },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(mockSupabase.from).toHaveBeenCalledWith("claim_history")
    expect(mockUpdate).toHaveBeenCalledWith({ tx_hash: "0xabc" })
    expect(mockEq).toHaveBeenCalledWith("task_id", "task-1")
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it("type 4 skips update when no hash", async () => {
    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 4,
        data: { id: "task-2", status: 100 },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(mockSupabase.from).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it("type 0 sets status to completed", async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.from.mockReturnValue({ update: mockUpdate, eq: mockEq })

    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 0,
        data: { id: "task-3", status: 200, hash: "0xdef" },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(mockSupabase.from).toHaveBeenCalledWith("claim_history")
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "completed",
      tx_hash: "0xdef",
    })
    expect(mockEq).toHaveBeenCalledWith("task_id", "task-3")
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it("type 1 sets status to failed", async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.from.mockReturnValue({ update: mockUpdate, eq: mockEq })

    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 1,
        data: { id: "task-4", status: 400 },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(mockSupabase.from).toHaveBeenCalledWith("claim_history")
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "failed",
      tx_hash: undefined,
    })
    expect(mockEq).toHaveBeenCalledWith("task_id", "task-4")
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it("unknown type returns received true", async () => {
    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 99,
        data: { id: "task-5", status: 999 },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(mockSupabase.from).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it("handles supabase update error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: new Error("DB error") })
    mockSupabase.from.mockReturnValue({ update: mockUpdate, eq: mockEq })

    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 0,
        data: { id: "task-6", status: 200, hash: "0x123" },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(consoleSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)

    consoleSpy.mockRestore()
  })

  it("returns 401 on invalid webhook signature", async () => {
    vi.mocked(verifyRelayerWebhook).mockResolvedValue(false)

    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 0,
        data: { id: "task-7", status: 200, hash: "0xaaa" },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe("Invalid webhook signature")
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it("verifies signature before processing valid payload", async () => {
    vi.mocked(verifyRelayerWebhook).mockResolvedValue(true)
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.from.mockReturnValue({ update: mockUpdate, eq: mockEq })

    const res = await POST(
      makeRequest({
        apiVersion: 0,
        type: 0,
        data: { id: "task-3", status: 200, hash: "0xdef" },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      })
    )

    expect(verifyRelayerWebhook).toHaveBeenCalled()
    expect(mockSupabase.from).toHaveBeenCalledWith("claim_history")
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "completed",
      tx_hash: "0xdef",
    })
    expect(mockEq).toHaveBeenCalledWith("task_id", "task-3")
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })
})
