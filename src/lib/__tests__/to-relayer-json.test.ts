import { describe, it, expect } from "vitest"
import { toRelayerJson } from "@/lib/oneshot/to-relayer-json"

describe("toRelayerJson", () => {
  it("converts bigint to 0x-hex string", () => {
    expect(toRelayerJson(123n)).toBe("0x7b")
  })

  it("converts bigint 0n", () => {
    expect(toRelayerJson(0n)).toBe("0x0")
  })

  it("converts Uint8Array to hex", () => {
    expect(toRelayerJson(new Uint8Array([0xde, 0xad]))).toBe("0xdead")
  })

  it("recurses into nested objects", () => {
    expect(toRelayerJson({ a: { b: 1n } })).toEqual({ a: { b: "0x1" } })
  })

  it("recurses into arrays", () => {
    expect(toRelayerJson([1n, 2n])).toEqual(["0x1", "0x2"])
  })

  it("passes strings through unchanged", () => {
    expect(toRelayerJson("hello")).toBe("hello")
  })

  it("passes numbers through unchanged", () => {
    expect(toRelayerJson(42)).toBe(42)
  })

  it("passes null and undefined through", () => {
    expect(toRelayerJson(null)).toBeNull()
    expect(toRelayerJson(undefined)).toBeUndefined()
  })

  it("handles mixed objects with bigint, string, and nested array", () => {
    const input = {
      name: "tx",
      value: 999n,
      tags: [1n, 2n, 3n],
      meta: { gas: 100000n },
    }
    const expected = {
      name: "tx",
      value: "0x3e7",
      tags: ["0x1", "0x2", "0x3"],
      meta: { gas: "0x186a0" },
    }
    expect(toRelayerJson(input)).toEqual(expected)
  })

  it("handles empty objects and arrays", () => {
    expect(toRelayerJson({})).toEqual({})
    expect(toRelayerJson([])).toEqual([])
  })
})
