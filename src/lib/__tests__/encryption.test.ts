import { vi } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";
import { webcrypto } from "node:crypto";

vi.stubGlobal("crypto", webcrypto);

describe("encryption", () => {
  const MOCK_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = MOCK_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe("encrypt and decrypt", () => {
    it("round-trips a simple string", async () => {
      const data = "hello quotra";
      const encrypted = await encrypt(data);
      expect(encrypted).toHaveProperty("encrypted_key");
      expect(encrypted).toHaveProperty("key_iv");
      expect(encrypted).toHaveProperty("key_auth_tag");
      expect(typeof encrypted.encrypted_key).toBe("string");
      expect(typeof encrypted.key_iv).toBe("string");
      expect(typeof encrypted.key_auth_tag).toBe("string");

      const decrypted = await decrypt(encrypted.encrypted_key, encrypted.key_iv, encrypted.key_auth_tag);
      expect(decrypted).toBe(data);
    });

    it("round-trips an empty string", async () => {
      const data = "";
      const encrypted = await encrypt(data);
      const decrypted = await decrypt(encrypted.encrypted_key, encrypted.key_iv, encrypted.key_auth_tag);
      expect(decrypted).toBe(data);
    });

    it("round-trips a long string", async () => {
      const data = "a".repeat(10_000);
      const encrypted = await encrypt(data);
      const decrypted = await decrypt(encrypted.encrypted_key, encrypted.key_iv, encrypted.key_auth_tag);
      expect(decrypted).toBe(data);
    });

    it("throws decrypting with tampered ciphertext", async () => {
      const encrypted = await encrypt("secret");
      encrypted.encrypted_key = encrypted.encrypted_key.slice(0, -4) + "0000";

      await expect(decrypt(encrypted.encrypted_key, encrypted.key_iv, encrypted.key_auth_tag)).rejects.toThrow(
        "Failed to decrypt data"
      );
    });

    it("throws decrypting with tampered iv", async () => {
      const encrypted = await encrypt("secret");
      encrypted.key_iv = encrypted.key_iv.slice(0, -2) + "00";

      await expect(decrypt(encrypted.encrypted_key, encrypted.key_iv, encrypted.key_auth_tag)).rejects.toThrow(
        "Failed to decrypt data"
      );
    });
    
    it("throws decrypting with tampered auth tag", async () => {
      const encrypted = await encrypt("secret");
      encrypted.key_auth_tag = encrypted.key_auth_tag.slice(0, -2) + "00";

      await expect(decrypt(encrypted.encrypted_key, encrypted.key_iv, encrypted.key_auth_tag)).rejects.toThrow(
        "Failed to decrypt data"
      );
    });

    it("throws if ENCRYPTION_KEY is missing", async () => {
      delete process.env.ENCRYPTION_KEY;
      await expect(encrypt("secret")).rejects.toThrow("Failed to encrypt data");
    });
    
    it("throws if ENCRYPTION_KEY is invalid length", async () => {
      process.env.ENCRYPTION_KEY = "1234";
      await expect(encrypt("secret")).rejects.toThrow("Failed to encrypt data");
    });
  });
});
