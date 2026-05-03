// @vitest-environment node
import type * as NodeOs from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const homedirState = vi.hoisted(() => ({ value: "" }));

vi.mock<typeof NodeOs>(import("node:os"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    homedir: () => homedirState.value,
  };
});

const fs = await import("node:fs/promises");
const os = await import("node:os");
const path = await import("node:path");

const {
  CryptoError,
  connectionsPath,
  decryptLine,
  encryptLine,
  keyPath,
  resetCryptoCache,
  setLegacyKeyLoader,
} = await import("@oh-my-query/core");

const legacyLoader = vi.fn<() => Promise<string | null>>();

const permsOf = (mode: number): string => mode.toString(8).slice(-3);

describe("crypto file-based key", () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "omq-crypto-"));
    homedirState.value = tmpHome;
    resetCryptoCache();
    legacyLoader.mockReset().mockResolvedValue(null);
    setLegacyKeyLoader(legacyLoader);
  });

  afterEach(async () => {
    setLegacyKeyLoader(null);
    await fs.rm(tmpHome, { force: true, recursive: true });
  });

  it("creates a fresh key file with 0600 perms when nothing exists", async () => {
    const ciphertext = await encryptLine("hello");
    expect(ciphertext).toBeTypeOf("string");

    const stat = await fs.stat(keyPath());
    expect(permsOf(stat.mode)).toBe("600");

    const dirStat = await fs.stat(path.dirname(keyPath()));
    expect(permsOf(dirStat.mode)).toBe("700");
  });

  it("round-trips encrypt/decrypt with the persisted key", async () => {
    const ciphertext = await encryptLine("hello world");
    resetCryptoCache();
    const plaintext = await decryptLine(ciphertext);
    expect(plaintext).toBe("hello world");
  });

  it("throws KEY_MISSING when the key file is gone but encrypted connections exist", async () => {
    const ciphertext = await encryptLine(JSON.stringify([{ id: "a" }]));
    await fs.writeFile(connectionsPath(), ciphertext);
    await fs.unlink(keyPath());
    resetCryptoCache();

    await expect(encryptLine("anything")).rejects.toMatchObject({
      code: "KEY_MISSING",
      name: "CryptoError",
    });
  });

  it("does not throw KEY_MISSING when connections.json is plaintext (legacy)", async () => {
    await fs.mkdir(path.dirname(connectionsPath()), { recursive: true });
    await fs.writeFile(connectionsPath(), '[{"id":"legacy"}]');

    await expect(encryptLine("anything")).resolves.toBeTypeOf("string");
    await expect(fs.access(keyPath())).resolves.toBeUndefined();
  });

  it("silently migrates an existing keytar key to the file on first run", async () => {
    const raw = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      raw[i] = i;
    }
    let bin = "";
    for (const byte of raw) {
      bin += String.fromCodePoint(byte);
    }
    const encodedKey = btoa(bin);
    legacyLoader.mockResolvedValueOnce(encodedKey);

    const ciphertext = await encryptLine("after migration");
    expect(legacyLoader).toHaveBeenCalledOnce();

    const fileContent = await fs.readFile(keyPath(), "utf8");
    expect(fileContent.trim()).toBe(encodedKey);

    legacyLoader.mockClear();
    resetCryptoCache();
    const plaintext = await decryptLine(ciphertext);
    expect(plaintext).toBe("after migration");
    expect(legacyLoader).not.toHaveBeenCalled();
  });

  it("ignores keytar errors during migration (no prompt blocking)", async () => {
    legacyLoader.mockRejectedValueOnce(new Error("user denied"));

    await expect(encryptLine("ok")).resolves.toBeTypeOf("string");
    await expect(fs.access(keyPath())).resolves.toBeUndefined();
  });

  it("cryptoError is exported with a code", () => {
    const e = new CryptoError("FOO", "bar");
    expect(e.code).toBe("FOO");
    expect(e.message).toBe("bar");
  });
});
