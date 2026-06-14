import { bytesToHex } from "viem/utils"

export function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "bigint") return `0x${value.toString(16)}`
  if (value instanceof Uint8Array) return bytesToHex(value)
  if (Array.isArray(value)) return value.map(toRelayerJson)
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = toRelayerJson(v)
    return out
  }
  return value
}
