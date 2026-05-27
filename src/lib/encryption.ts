/**
 * AES-256-GCM encryption utilities using Web Crypto API
 * Used for encrypting provider API keys before storing in Supabase
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits as recommended for AES-GCM

/**
 * Generates a random AES-256-GCM encryption key
 * @returns Promise<CryptoKey> - The generated encryption key
 * @throws Error if key generation fails
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  try {
    const key = await crypto.subtle.generateKey(
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
    return key;
  } catch (error) {
    throw new Error(
      `Failed to generate encryption key: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Exports a CryptoKey to a base64 string for storage
 * @param key - The CryptoKey to export
 * @returns Promise<string> - Base64 encoded key
 * @throws Error if export fails
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  try {
    const exported = await crypto.subtle.exportKey("raw", key);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    return base64;
  } catch (error) {
    throw new Error(
      `Failed to export encryption key: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Imports a base64 encoded string back into a CryptoKey
 * @param keyStr - Base64 encoded key string
 * @returns Promise<CryptoKey> - The imported key
 * @throws Error if import fails
 */
export async function importKey(keyStr: string): Promise<CryptoKey> {
  try {
    const binaryStr = atob(keyStr);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const key = await crypto.subtle.importKey(
      "raw",
      bytes,
      {
        name: ALGORITHM,
        length: KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );
    return key;
  } catch (error) {
    throw new Error(
      `Failed to import encryption key: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Encrypts data using AES-256-GCM
 * @param data - Plaintext string to encrypt
 * @param key - CryptoKey for encryption
 * @returns Promise<{ ciphertext: string; iv: string }> - Base64 encoded ciphertext and IV
 * @throws Error if encryption fails
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  try {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
      },
      key,
      encodedData
    );

    const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return {
      ciphertext,
      iv: ivBase64,
    };
  } catch (error) {
    throw new Error(
      `Failed to encrypt data: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Decrypts data using AES-256-GCM
 * @param encrypted - Object containing base64 encoded ciphertext and iv
 * @param key - CryptoKey for decryption
 * @returns Promise<string> - Decrypted plaintext
 * @throws Error if decryption fails
 */
export async function decrypt(
  encrypted: { ciphertext: string; iv: string },
  key: CryptoKey
): Promise<string> {
  try {
    const ciphertextBytes = Uint8Array.from(atob(encrypted.ciphertext), (c) =>
      c.charCodeAt(0)
    );
    const ivBytes = Uint8Array.from(atob(encrypted.iv), (c) => c.charCodeAt(0));

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: ivBytes,
      },
      key,
      ciphertextBytes
    );

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decryptedBuffer);
    return plaintext;
  } catch (error) {
    throw new Error(
      `Failed to decrypt data: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}