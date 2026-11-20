import fs from "node:fs/promises";
import path from "node:path";

const fileLocks = new Map<string, Promise<unknown>>();

const awaitQuietly = async (p: Promise<unknown> | undefined): Promise<void> => {
  if (!p) {
    return;
  }
  try {
    await p;
  } catch {
    // the previous holder reports its own failure
  }
};

export function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = fileLocks.get(filePath);
  const work = async (): Promise<T> => {
    await awaitQuietly(prev);
    try {
      return await fn();
    } finally {
      if (fileLocks.get(filePath) === slot) {
        fileLocks.delete(filePath);
      }
    }
  };
  const slot: Promise<T> = work();
  fileLocks.set(filePath, slot);
  return slot;
}

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function atomicWrite(
  filePath: string,
  data: string | Uint8Array
): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, filePath);
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
