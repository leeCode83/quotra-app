import { vi, beforeEach, afterEach, describe, it, expect } from "vitest";
import * as ed from "@noble/ed25519";
import Crypto from "node:crypto";
import stringify from "safe-stable-stringify";

const sha512Node = (m: Uint8Array) =>
  new Uint8Array(Crypto.createHash("sha512").update(Buffer.from(m)).digest());

ed.hashes.sha512 = sha512Node;
ed.hashes.sha512Async = async (m: Uint8Array) => sha512Node(m);

function bytesToBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyRelayerWebhook", () => {
  it("valid signature returns true", async () => {
    const { verifyRelayerWebhook } = await import("../oneshot/verify-relayer-webhook");

    const sk = ed.utils.randomSecretKey();
    const pk = await ed.getPublicKeyAsync(sk);

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        keys: [{ kty: "OKP", crv: "Ed25519", kid: "test-key", x: bytesToBase64url(pk) }],
      }),
    });

    const body = { action: "approve", amount: "50", keyId: "test-key" };
    const sig = await ed.signAsync(new TextEncoder().encode(stringify(body)), sk);
    const payload = { ...body, signature: Buffer.from(sig).toString("base64") };

    expect(await verifyRelayerWebhook(payload)).toBe(true);
  });

  it("invalid signature returns false", async () => {
    const { verifyRelayerWebhook } = await import("../oneshot/verify-relayer-webhook");

    const sk = ed.utils.randomSecretKey();
    const pk = await ed.getPublicKeyAsync(sk);

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        keys: [{ kty: "OKP", crv: "Ed25519", kid: "test-key", x: bytesToBase64url(pk) }],
      }),
    });

    const body = { action: "approve", amount: "50", keyId: "test-key" };
    const sig = await ed.signAsync(new TextEncoder().encode(stringify(body)), sk);
    const badSig = Buffer.from(sig);
    badSig[0] ^= 0xff;
    const payload = { ...body, signature: badSig.toString("base64") };

    expect(await verifyRelayerWebhook(payload)).toBe(false);
  });

  it("missing signature returns false", async () => {
    const { verifyRelayerWebhook } = await import("../oneshot/verify-relayer-webhook");

    const payload = { action: "approve", amount: "50", keyId: "test-key" };
    expect(await verifyRelayerWebhook(payload as Record<string, unknown>)).toBe(false);
  });

  it("missing keyId returns false", async () => {
    const { verifyRelayerWebhook } = await import("../oneshot/verify-relayer-webhook");

    const payload = { action: "test", signature: "AAAA" };
    expect(await verifyRelayerWebhook(payload as Record<string, unknown>)).toBe(false);
  });

  it("caches JWKS and refreshes on key rotation", async () => {
    const { verifyRelayerWebhook } = await import("../oneshot/verify-relayer-webhook");

    const skA = ed.utils.randomSecretKey();
    const pkA = await ed.getPublicKeyAsync(skA);
    const skB = ed.utils.randomSecretKey();
    const pkB = await ed.getPublicKeyAsync(skB);

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        keys: [{ kty: "OKP", crv: "Ed25519", kid: "key-A", x: bytesToBase64url(pkA) }],
      }),
    });

    const bodyA = { action: "test", amount: "100", keyId: "key-A" };
    const sigA = await ed.signAsync(new TextEncoder().encode(stringify(bodyA)), skA);
    const payloadA = { ...bodyA, signature: Buffer.from(sigA).toString("base64") };

    expect(await verifyRelayerWebhook(payloadA)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        keys: [{ kty: "OKP", crv: "Ed25519", kid: "key-B", x: bytesToBase64url(pkB) }],
      }),
    });

    expect(await verifyRelayerWebhook(payloadA)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const bodyB = { action: "test", amount: "200", keyId: "key-B" };
    const sigB = await ed.signAsync(new TextEncoder().encode(stringify(bodyB)), skB);
    const payloadB = { ...bodyB, signature: Buffer.from(sigB).toString("base64") };

    expect(await verifyRelayerWebhook(payloadB)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
