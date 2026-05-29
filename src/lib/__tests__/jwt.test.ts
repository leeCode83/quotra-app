import { vi } from "vitest";

// Patch TextEncoder so its returned Uint8Array passes instanceof checks in this realm.
vi.hoisted(() => {
  const OriginalTextEncoder = globalThis.TextEncoder;
  globalThis.TextEncoder = class extends OriginalTextEncoder {
    encode(str: string): Uint8Array<ArrayBuffer> {
      const buf = super.encode(str);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) as unknown as Uint8Array<ArrayBuffer>;
    }
  } as typeof TextEncoder;
});

import { getJWTSecret, signJWT, verifyJWT } from "@/lib/jwt";

describe("jwt", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getJWTSecret", () => {
    it("throws when JWT_SECRET is not set", () => {
      delete process.env.JWT_SECRET;
      expect(() => getJWTSecret()).toThrow("JWT_SECRET environment variable is not set");
    });

    it("returns environment secret when JWT_SECRET is set", () => {
      process.env.JWT_SECRET = "my-production-secret";
      const secret = getJWTSecret();
      expect(new TextDecoder().decode(secret)).toBe("my-production-secret");
    });
  });

  describe("signJWT", () => {
    it("signs a token with wallet_address as subject", async () => {
      const token = await signJWT({ wallet_address: "0xABC" });
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("signs a token with explicit subject overriding wallet_address", async () => {
      const token = await signJWT({ wallet_address: "0xABC" }, "custom-sub");
      const payload = await verifyJWT(token);
      expect(payload.sub).toBe("custom-sub");
    });

    it("throws when signing fails", async () => {
      const badPayload = { get wallet_address() { throw new Error("bad"); } };
      await expect(signJWT(badPayload)).rejects.toThrow("Failed to sign JWT");
    });
  });

  describe("verifyJWT", () => {
    it("verifies a valid token and returns payload", async () => {
      const payload = { wallet_address: "0x123", role: "admin" };
      const token = await signJWT(payload);
      const verified = await verifyJWT(token);
      expect(verified.wallet_address).toBe("0x123");
      expect(verified.role).toBe("admin");
    });

    it("rejects an expired token", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "test-secret-key-that-is-at-least-32-bytes");
      
      const jwt = new SignJWT({ wallet_address: "0x123" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600);
        
      const token = await jwt.sign(secret);

      await expect(verifyJWT(token)).rejects.toThrow("Failed to verify JWT");
    });

    it("rejects a token with invalid signature", async () => {
      const token = await signJWT({ wallet_address: "0x123" });
      const invalidToken = token.slice(0, -4) + "XXXX";
      await expect(verifyJWT(invalidToken)).rejects.toThrow(
        "Failed to verify JWT"
      );
    });

    it("rejects a malformed token", async () => {
      await expect(verifyJWT("not-a-jwt")).rejects.toThrow(
        "Failed to verify JWT"
      );
    });

    it("uses JWT_SECRET env var when available", async () => {
      process.env.JWT_SECRET = "env-specific-secret";
      const payload = { wallet_address: "0xENV" };
      const token = await signJWT(payload);
      const verified = await verifyJWT(token);
      expect(verified.wallet_address).toBe("0xENV");
    });
  });
});
