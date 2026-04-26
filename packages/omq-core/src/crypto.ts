import keytar from "keytar";

const KEYRING_SERVICE = "oh-my-query";
const KEYRING_USER = "history-encryption-key";
const KEY_LEN = 32;
const NONCE_LEN = 12;

let cachedKey: CryptoKey | null = null;
let initInFlight: Promise<CryptoKey> | null = null;

function importKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_LEN) {
    return Promise.reject(
      new CryptoError("INVALID_KEY_LEN", "invalid key length in keyring")
    );
  }
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  let encoded: string | null;
  try {
    encoded = await keytar.getPassword(KEYRING_SERVICE, KEYRING_USER);
  } catch (error) {
    throw new CryptoError(
      "KEYRING_ERROR",
      `keyring error: ${(error as Error).message}`
    );
  }

  if (encoded) {
    let raw: Uint8Array;
    try {
      raw = b64decode(encoded.trim());
    } catch {
      throw new CryptoError("BASE64_DECODE_FAILED", "base64 decode failed");
    }
    return importKey(raw);
  }

  const raw = new Uint8Array(KEY_LEN);
  crypto.getRandomValues(raw);
  try {
    await keytar.setPassword(KEYRING_SERVICE, KEYRING_USER, b64encode(raw));
  } catch (error) {
    throw new CryptoError(
      "KEYRING_ERROR",
      `keyring error: ${(error as Error).message}`
    );
  }
  return importKey(raw);
}

function getKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return Promise.resolve(cachedKey);
  }
  initInFlight ??= (async () => {
    const key = await loadOrCreateKey();
    cachedKey = key;
    return key;
  })();
  return initInFlight;
}

export async function encryptLine(plaintext: string): Promise<string> {
  const key = await getKey();
  const nonce = new Uint8Array(NONCE_LEN);
  crypto.getRandomValues(nonce);
  const data = new TextEncoder().encode(plaintext);
  let cipher: ArrayBuffer;
  try {
    cipher = await crypto.subtle.encrypt(
      { iv: nonce as BufferSource, name: "AES-GCM" },
      key,
      data as BufferSource
    );
  } catch {
    throw new CryptoError("ENCRYPT_FAILED", "encryption failed");
  }
  const combined = new Uint8Array(NONCE_LEN + cipher.byteLength);
  combined.set(nonce, 0);
  combined.set(new Uint8Array(cipher), NONCE_LEN);
  return b64encode(combined);
}

export async function decryptLine(encoded: string): Promise<string> {
  const key = await getKey();
  let bytes: Uint8Array;
  try {
    bytes = b64decode(encoded.trim());
  } catch {
    throw new CryptoError("BASE64_DECODE_FAILED", "base64 decode failed");
  }
  if (bytes.length <= NONCE_LEN) {
    throw new CryptoError("CIPHERTEXT_TOO_SHORT", "ciphertext too short");
  }
  const nonce = bytes.subarray(0, NONCE_LEN);
  const cipher = bytes.subarray(NONCE_LEN);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { iv: nonce as BufferSource, name: "AES-GCM" },
      key,
      cipher as BufferSource
    );
  } catch {
    throw new CryptoError("DECRYPT_FAILED", "decryption failed");
  }
  return new TextDecoder().decode(plain);
}

export class CryptoError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CryptoError";
    this.code = code;
  }
}

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) {
    bin += String.fromCodePoint(byte);
  }
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.codePointAt(i) ?? 0;
  }
  return out;
}
