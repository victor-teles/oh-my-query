import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "omq-core-crypto-"));

vi.mock<typeof NodeOs>("node:os", async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const {
  CryptoError,
  decryptLine,
  encryptLine,
  resetCryptoCache,
  setLegacyKeyLoader,
} = await import("./crypto.ts");
const { connectionsPath, keyPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) {
    bin += String.fromCodePoint(byte);
  }
  return btoa(bin);
}

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

function decodeBase64ToBytes(s: string): Uint8Array {
  const decoded = atob(s);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.codePointAt(i) ?? 0;
  }
  return bytes;
}

function flipLastByte(bytes: Uint8Array): void {
  const lastIndex = bytes.length - 1;
  const previous = bytes[lastIndex] ?? 0;
  bytes[lastIndex] = (previous + 1) % 256;
}

describe("crypto", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("round-trips arbitrary UTF-8 including emoji and newlines", async () => {
    const plaintext = "héllo 🌍\nline two\t— done";
    const enc = await encryptLine(plaintext);
    const dec = await decryptLine(enc);
    expect(dec).toBe(plaintext);
  });

  it("uses a random nonce so the same plaintext yields different ciphertexts", async () => {
    const a = await encryptLine("same input");
    const b = await encryptLine("same input");
    expect(a).not.toBe(b);
    await expect(decryptLine(a)).resolves.toBe("same input");
    await expect(decryptLine(b)).resolves.toBe("same input");
  });

  it("writes the .key file with mode 0o600 on first encrypt", async () => {
    await encryptLine("first");
    const stat = await fs.stat(keyPath());
    const permissionBits = stat.mode % 0o1000;
    expect(permissionBits).toBe(0o600);
  });

  it("does not rewrite the .key file on subsequent encrypts (cache reuse)", async () => {
    await encryptLine("first");
    const beforeStat = await fs.stat(keyPath());
    await encryptLine("second");
    const afterStat = await fs.stat(keyPath());
    expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it("reuses an existing .key file after cache reset", async () => {
    const enc = await encryptLine("durable");
    resetCryptoCache();
    await expect(decryptLine(enc)).resolves.toBe("durable");
  });

  it("generates a fresh key when no key file and no encrypted data exists", async () => {
    await encryptLine("first");
    const firstKey = await fs.readFile(keyPath(), "utf8");
    resetCryptoCache();
    await fs.unlink(keyPath());
    await encryptLine("after");
    const secondKey = await fs.readFile(keyPath(), "utf8");
    expect(secondKey).not.toBe(firstKey);
  });

  it("treats a plaintext-JSON connections file as not encrypted and creates a fresh key", async () => {
    await fs.mkdir(appConfigDir(TMP_HOME), { recursive: true });
    await fs.writeFile(
      connectionsPath(),
      JSON.stringify([{ id: "x", name: "y" }])
    );
    await expect(encryptLine("hi")).resolves.toStrictEqual(expect.any(String));
  });

  it("throws KEY_MISSING when encrypted-looking connections exist with no key", async () => {
    await fs.mkdir(appConfigDir(TMP_HOME), { recursive: true });
    await fs.writeFile(connectionsPath(), "deadbeefdeadbeef");
    await expect(encryptLine("hi")).rejects.toMatchObject({
      code: "KEY_MISSING",
    });
  });

  it("migrates a valid legacy key from the keytar loader", async () => {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const encoded = b64encode(raw);
    // oxlint-disable-next-line require-await -- inline test loader
    setLegacyKeyLoader(async () => encoded);
    await encryptLine("hello");
    const keyContent = await fs.readFile(keyPath(), "utf8");
    expect(keyContent.trim()).toBe(encoded);
  });

  it("falls through to a fresh key when the legacy loader returns a malformed key", async () => {
    const tooShort = new Uint8Array(16);
    crypto.getRandomValues(tooShort);
    const encoded = b64encode(tooShort);
    // oxlint-disable-next-line require-await -- inline test loader
    setLegacyKeyLoader(async () => encoded);
    const enc = await encryptLine("ok");
    await expect(decryptLine(enc)).resolves.toBe("ok");
    const keyContent = await fs.readFile(keyPath(), "utf8");
    expect(keyContent.trim()).not.toBe(encoded);
  });

  it("throws CIPHERTEXT_TOO_SHORT for too-short inputs", async () => {
    await encryptLine("warmup");
    const short = b64encode(new Uint8Array(8));
    await expect(decryptLine(short)).rejects.toMatchObject({
      code: "CIPHERTEXT_TOO_SHORT",
    });
  });

  it("throws BASE64_DECODE_FAILED for non-base64 input", async () => {
    await encryptLine("warmup");
    await expect(decryptLine("@@@not_base64@@@")).rejects.toMatchObject({
      code: "BASE64_DECODE_FAILED",
    });
  });

  it("throws DECRYPT_FAILED on tampered ciphertext", async () => {
    const enc = await encryptLine("secret");
    const bytes = decodeBase64ToBytes(enc);
    flipLastByte(bytes);
    const tampered = b64encode(bytes);
    await expect(decryptLine(tampered)).rejects.toMatchObject({
      code: "DECRYPT_FAILED",
    });
  });

  it("cryptoError carries name and code", () => {
    const err = new CryptoError("X", "y");
    expect(err.name).toBe("CryptoError");
    expect(err.code).toBe("X");
    expect(err.message).toBe("y");
  });
});
