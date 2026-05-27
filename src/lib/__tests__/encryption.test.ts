import { vi } from "vitest";
import {
  generateEncryptionKey,
  exportKey,
  importKey,
  encrypt,
  decrypt,
} from "@/lib/encryption";

// jsdom does not implement crypto.subtle; stub with Node.js webcrypto
import { webcrypto } from "node:crypto";
vi.stubGlobal("crypto", webcrypto);

describe("encryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateEncryptionKey", () => {
    it("generates an extractable AES-GCM CryptoKey", async () => {
      const key = await generateEncryptionKey();
      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe("AES-GCM");
      expect(key.extractable).toBe(true);
      expect(key.usages).toContain("encrypt");
      expect(key.usages).toContain("decrypt");
    });

    it("throws when crypto.subtle.generateKey fails", async () => {
      const originalGenerateKey = crypto.subtle.generateKey;
      crypto.subtle.generateKey = vi
        .fn()
        .mockRejectedValue(new Error("subtle failure"));

      await expect(generateEncryptionKey()).rejects.toThrow(
        "Failed to generate encryption key: subtle failure"
      );

      crypto.subtle.generateKey = originalGenerateKey;
    });
  });

  describe("exportKey and importKey", () => {
    it("round-trips a key through base64 export/import", async () => {
      const key = await generateEncryptionKey();
      const exported = await exportKey(key);
      expect(typeof exported).toBe("string");
      expect(exported.length).toBeGreaterThan(0);

      const imported = await importKey(exported);
      expect(imported.algorithm.name).toBe("AES-GCM");
      expect(imported.extractable).toBe(true);
    });

    it("throws on importKey with invalid base64", async () => {
      await expect(importKey("not-valid-base64!!!")).rejects.toThrow(
        "Failed to import encryption key"
      );
    });

    it("throws on importKey with empty string", async () => {
      await expect(importKey("")).rejects.toThrow(
        "Failed to import encryption key"
      );
    });
  });

  describe("encrypt and decrypt", () => {
    it("round-trips a simple string", async () => {
      const key = await generateEncryptionKey();
      const data = "hello quotra";
      const encrypted = await encrypt(data, key);
      expect(encrypted).toHaveProperty("ciphertext");
      expect(encrypted).toHaveProperty("iv");
      expect(typeof encrypted.ciphertext).toBe("string");
      expect(typeof encrypted.iv).toBe("string");

      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(data);
    });

    it("round-trips an empty string", async () => {
      const key = await generateEncryptionKey();
      const data = "";
      const encrypted = await encrypt(data, key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(data);
    });

    it("round-trips a long string", async () => {
      const key = await generateEncryptionKey();
      const data = "a".repeat(10_000);
      const encrypted = await encrypt(data, key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(data);
    });

    it("round-trips after exporting and re-importing the key", async () => {
      const key = await generateEncryptionKey();
      const exported = await exportKey(key);
      const imported = await importKey(exported);

      const data = "persisted key test";
      const encrypted = await encrypt(data, imported);
      const decrypted = await decrypt(encrypted, imported);
      expect(decrypted).toBe(data);
    });

    it("throws decrypting with tampered ciphertext", async () => {
      const key = await generateEncryptionKey();
      const encrypted = await encrypt("secret", key);
      encrypted.ciphertext = encrypted.ciphertext.slice(0, -4) + "AAAA";

      await expect(decrypt(encrypted, key)).rejects.toThrow(
        "Failed to decrypt data"
      );
    });

    it("throws decrypting with tampered iv", async () => {
      const key = await generateEncryptionKey();
      const encrypted = await encrypt("secret", key);
      encrypted.iv = encrypted.iv.slice(0, -2) + "AA";

      await expect(decrypt(encrypted, key)).rejects.toThrow(
        "Failed to decrypt data"
      );
    });

    it("throws encrypting with an invalid key", async () => {
      const invalidKey = {} as CryptoKey;
      await expect(encrypt("secret", invalidKey)).rejects.toThrow(
        "Failed to encrypt data"
      );
    });
  });
});
