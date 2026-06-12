/**
 * AES-256-GCM encryption utilities using Web Crypto API
 * Used for encrypting provider API keys before storing in Supabase
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits as recommended for AES-GCM

/**
 * Converts an ArrayBuffer to a hex string
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converts a hex string to a Uint8Array
 */
export function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Gets the encryption key from environment variable
 * @returns Promise<CryptoKey> - The encryption key
 * @throws Error if ENCRYPTION_KEY environment variable is not set or invalid
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const hexKey = process.env.QUOTRA_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error("QUOTRA_ENCRYPTION_KEY environment variable is not set.");
  }
  
  try {
    let keyBytes: Uint8Array;
    if (/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      keyBytes = hexToBuffer(hexKey);
    } else {
      const binaryString = atob(hexKey);
      keyBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        keyBytes[i] = binaryString.charCodeAt(i);
      }
    }

    if (keyBytes.byteLength !== KEY_LENGTH / 8) {
      throw new Error(`QUOTRA_ENCRYPTION_KEY must be exactly ${KEY_LENGTH / 8} bytes`);
    }

    return await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as BufferSource,
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      false, // non-extractable
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    throw new Error(
      `Failed to initialize encryption key: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Encrypts data using AES-256-GCM
 * @param data - Plaintext string to encrypt
 * @returns Promise<{ encrypted_key: string; key_iv: string; key_auth_tag: string }> - Hex encoded ciphertext, IV, and auth tag
 * @throws Error if encryption fails
 */
export async function encrypt(
  data: string
): Promise<{ encrypted_key: string; key_iv: string; key_auth_tag: string }> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv as unknown as BufferSource,
      },
      key,
      encodedData as unknown as BufferSource
    );

    // Web Crypto appends the 16-byte authentication tag to the ciphertext
    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const ciphertext = encryptedBytes.slice(0, -16);
    const authTag = encryptedBytes.slice(-16);

    return {
      encrypted_key: bufferToHex(ciphertext.buffer),
      key_iv: bufferToHex(iv.buffer),
      key_auth_tag: bufferToHex(authTag.buffer),
    };
  } catch (error) {
    throw new Error(
      `Failed to encrypt data: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Decrypts data using AES-256-GCM
 * @param encrypted_key - Hex encoded ciphertext
 * @param key_iv - Hex encoded IV
 * @param key_auth_tag - Hex encoded authentication tag
 * @returns Promise<string> - Decrypted plaintext
 * @throws Error if decryption fails
 */
export async function decrypt(
  encrypted_key: string,
  key_iv: string,
  key_auth_tag: string
): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const ciphertextBytes = hexToBuffer(encrypted_key);
    const ivBytes = hexToBuffer(key_iv);
    const authTagBytes = hexToBuffer(key_auth_tag);

    // Web Crypto expects the authentication tag to be appended to the ciphertext
    const combinedBytes = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
    combinedBytes.set(ciphertextBytes);
    combinedBytes.set(authTagBytes, ciphertextBytes.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: ivBytes as unknown as BufferSource,
      },
      key,
      combinedBytes as unknown as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    throw new Error(
      `Failed to decrypt data: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}