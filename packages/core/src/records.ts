import fs from "node:fs/promises";

import { decryptLine, encryptLine } from "./crypto.ts";
import {
  atomicWrite,
  ensureParentDir,
  pathExists,
  withFileLock,
} from "./fs-utils.ts";

export type RecordParser<T> = (raw: unknown) => T | null;

export interface Identified {
  id: string;
}

const hasId = (raw: unknown): raw is Identified =>
  typeof raw === "object" &&
  raw !== null &&
  typeof (raw as { id?: unknown }).id === "string";

// An unreadable file is set aside rather than overwritten, so a key mix-up
// never silently destroys saved records.
const quarantine = async (filePath: string, error: unknown): Promise<void> => {
  const aside = `${filePath}.corrupt-${Date.now()}`;
  console.warn(
    `[records] ${filePath} is unreadable (${String(error)}); moved to ${aside}`
  );
  await fs.rename(filePath, aside);
};

export const readRecords = async (filePath: string): Promise<Identified[]> => {
  if (!(await pathExists(filePath))) {
    return [];
  }
  const raw = await fs.readFile(filePath, "utf8");
  const content = raw.trim();
  if (!content) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(await decryptLine(content));
    if (!Array.isArray(parsed)) {
      throw new TypeError("expected a list");
    }
    return parsed.filter(hasId);
  } catch (error) {
    await quarantine(filePath, error);
    return [];
  }
};

const writeRecords = async (
  filePath: string,
  records: readonly Identified[]
): Promise<void> => {
  await ensureParentDir(filePath);
  await atomicWrite(filePath, await encryptLine(JSON.stringify(records)));
};

export const parseAll = <T>(
  records: readonly unknown[],
  parse: RecordParser<T>
): T[] =>
  records.flatMap((raw) => {
    const parsed = parse(raw);
    return parsed === null ? [] : [parsed];
  });

export const updateRecords = (
  filePath: string,
  change: (records: Identified[]) => Identified[]
): Promise<void> =>
  withFileLock(filePath, async () => {
    await writeRecords(filePath, change(await readRecords(filePath)));
  });

// Records the parser rejects (a newer or older shape) are kept on every write.
export const createRecordStore = <T extends Identified>(
  filePath: () => string,
  parse: RecordParser<T>
) => {
  const list = (): Promise<T[]> =>
    withFileLock(filePath(), async () =>
      parseAll(await readRecords(filePath()), parse)
    );

  const updateWhere = async (
    matches: (record: T) => boolean,
    change: (record: T) => T
  ): Promise<T[]> => {
    const updated: T[] = [];
    await updateRecords(filePath(), (records) =>
      records.map((record) => {
        const parsed = parse(record);
        if (!(parsed && matches(parsed))) {
          return record;
        }
        const next = change(parsed);
        updated.push(next);
        return next;
      })
    );
    return updated;
  };

  return {
    async get(id: string): Promise<T | null> {
      const records = await list();
      return records.find((record) => record.id === id) ?? null;
    },
    list,
    async remove(id: string): Promise<void> {
      await updateRecords(filePath(), (records) =>
        records.filter((record) => record.id !== id)
      );
    },
    async save(record: T): Promise<T> {
      await updateRecords(filePath(), (records) => {
        const index = records.findIndex((item) => item.id === record.id);
        return index === -1
          ? [...records, record]
          : records.with(index, record);
      });
      return record;
    },
    async update(id: string, change: (record: T) => T): Promise<T | null> {
      const [updated] = await updateWhere((record) => record.id === id, change);
      return updated ?? null;
    },
    updateWhere,
  };
};
