/**
 * Local encryption primitives for NextClaw's pseudonym (极限托名) mode.
 *
 * AES-GCM symmetric encryption with a locally derived key. The key is derived
 * from a user-provided passphrase (or a locally generated random secret) via
 * PBKDF2. All state stays on the local machine; nothing is sent to any remote
 * service.
 */

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function importWebCrypto(): Crypto | null {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    return globalThis.crypto as Crypto;
  }
  return null;
}

/**
 * Derive a 256-bit AES key from a passphrase. `salt` should be random and
 * persisted alongside the ciphertext. Returns the raw key bytes (for
 * base64 storage) and a CryptoKey handle for one-shot use.
 */
export async function deriveLocalKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const crypto = importWebCrypto();
  if (!crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function randomSalt(): Uint8Array {
  const crypto = importWebCrypto();
  if (!crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * Encrypt `plaintext` with AES-GCM. Returns a string encoding
 * `base64(salt):base64(iv):base64(ciphertext)`. The caller persists the
 * result locally.
 */
export async function encryptLocal(
  passphrase: string,
  plaintext: string,
): Promise<string> {
  const crypto = importWebCrypto();
  if (!crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  const salt = randomSalt();
  const key = await deriveLocalKey(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return [
    bytesToBase64(salt),
    bytesToBase64(iv),
    bytesToBase64(new Uint8Array(ciphertext)),
  ].join(":");
}

/**
 * Decrypt a value produced by {@link encryptLocal}. Throws on a wrong
 * passphrase or tampered ciphertext.
 */
export async function decryptLocal(
  passphrase: string,
  payload: string,
): Promise<string> {
  const crypto = importWebCrypto();
  if (!crypto) {
    throw new Error("Web Crypto is not available in this environment");
  }
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext");
  }
  const salt = base64ToBytes(parts[0]);
  const iv = base64ToBytes(parts[1]);
  const ciphertext = base64ToBytes(parts[2]);
  if (salt.byteLength !== SALT_BYTES || iv.byteLength !== IV_BYTES) {
    throw new Error("Ciphertext is too short");
  }
  const key = await deriveLocalKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

function base64ToBytes(payload: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(payload, "base64"));
}
