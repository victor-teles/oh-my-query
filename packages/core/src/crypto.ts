import fs from "node:fs/promises";
import path from "node:path";

import { connectionsPath, keyPath } from "./paths.ts";

const LEGACY_KEYRING_SERVICE = "oh-my-query";
const LEGACY_KEYRING_USER = "history-encryption-key";
const KEY_LEN = 32;
const NONCE_LEN = 12;
const KEY_FILE_MODE = 0o600;
const KEY_DIR_MODE = 0o700;

let cachedKey: CryptoKey | null = null;
let initInFlight: Promise<CryptoKey> | null = null;

function importKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_LEN) {
    return Promise.reject(
      new CryptoError("INVALID_KEY_LEN", "invalid key length")
    );
  }
  return crypto.subtle.importKey(
    "raw",
    raw as NodeJS.BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function readKeyFile(): Promise<Uint8Array | null> {
  let content: string;
  try {
    content = await fs.readFile(keyPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new CryptoError(
      "KEY_READ_FAILED",
      `failed to read key file: ${(error as Error).message}`
    );
  }
  try {
    return b64decode(content.trim());
  } catch {
    throw new CryptoError(
      "BASE64_DECODE_FAILED",
      "key file base64 decode failed"
    );
  }
}

async function writeKeyFile(raw: Uint8Array): Promise<void> {
  const file = keyPath();
  await fs.mkdir(path.dirname(file), { mode: KEY_DIR_MODE, recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, b64encode(raw), { mode: KEY_FILE_MODE });
  await fs.rename(tmp, file);
}

type LegacyKeyLoader = () => Promise<string | null>;

let legacyKeyLoader: LegacyKeyLoader | null = null;

export function setLegacyKeyLoader(loader: LegacyKeyLoader | null): void {
  legacyKeyLoader = loader;
}

async function defaultLegacyKeyLoader(): Promise<string | null> {
  const keytar = await import("keytar");
  return keytar.getPassword(LEGACY_KEYRING_SERVICE, LEGACY_KEYRING_USER);
}

async function migrateFromKeytar(): Promise<Uint8Array | null> {
  const loader = legacyKeyLoader ?? defaultLegacyKeyLoader;
  try {
    const encoded = await loader();
    if (!encoded) {
      return null;
    }
    const raw = b64decode(encoded.trim());
    if (raw.length !== KEY_LEN) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

async function hasExistingEncryptedConnections(): Promise<boolean> {
  let content: string;
  try {
    content = await fs.readFile(connectionsPath(), "utf8");
  } catch {
    return false;
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  return !(trimmed.startsWith("[") || trimmed.startsWith("{"));
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  const existing = await readKeyFile();
  if (existing) {
    return importKey(existing);
  }

  const migrated = await migrateFromKeytar();
  if (migrated) {
    await writeKeyFile(migrated);
    return importKey(migrated);
  }

  if (await hasExistingEncryptedConnections()) {
    throw new CryptoError(
      "KEY_MISSING",
      "encryption key is missing but encrypted data exists on disk"
    );
  }

  const fresh = new Uint8Array(KEY_LEN);
  crypto.getRandomValues(fresh);
  await writeKeyFile(fresh);
  return importKey(fresh);
}

function getKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return Promise.resolve(cachedKey);
  }
  initInFlight ??= (async () => {
    try {
      const key = await loadOrCreateKey();
      cachedKey = key;
      return key;
    } finally {
      initInFlight = null;
    }
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
      { iv: nonce as NodeJS.BufferSource, name: "AES-GCM" },
      key,
      data as NodeJS.BufferSource
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
      { iv: nonce as NodeJS.BufferSource, name: "AES-GCM" },
      key,
      cipher as NodeJS.BufferSource
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

export function resetCryptoCache(): void {
  cachedKey = null;
  initInFlight = null;
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
