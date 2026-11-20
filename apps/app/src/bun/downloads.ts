import { DbError } from "@oh-my-query/core";
import { randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const SAVE_EXTENSIONS = ["csv", "omq.json"] as const;
export type SaveExtension = (typeof SAVE_EXTENSIONS)[number];

const MAX_CONTENT_BYTES = 20 * 1024 * 1024;
const MAX_SUFFIX = 99;
const REMEMBERED_SAVES = 20;
const SLUG = /^[a-z0-9-]{1,60}$/;
const NON_SLUG = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

export const slugBaseName = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll(NON_SLUG, "-")
    .slice(0, 60)
    .replaceAll(EDGE_DASHES, "");

const SaveRequest = z.object({
  baseName: z.string().transform(slugBaseName).pipe(z.string().regex(SLUG)),
  content: z
    .string()
    .refine((text) => Buffer.byteLength(text) <= MAX_CONTENT_BYTES, {
      message: "The file is larger than 20 MB.",
    }),
  extension: z.enum(SAVE_EXTENSIONS),
});

export interface SaveResult {
  fileName: string;
  savedId: string;
}

export interface DownloadsDeps {
  dir: () => string;
  writeExclusive(path: string, content: string): Promise<void>;
  reveal(path: string): void;
}

export const writeExclusive = async (
  path: string,
  content: string
): Promise<void> => {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(content);
  } finally {
    await handle.close();
  }
};

const isAlreadyExists = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

const candidateName = (baseName: string, extension: string, n: number) =>
  n === 1 ? `${baseName}.${extension}` : `${baseName}-${n}.${extension}`;

export const createDownloads = (deps: DownloadsDeps) => {
  const saved = new Map<string, string>();

  const remember = (path: string): string => {
    const savedId = randomUUID();
    saved.set(savedId, path);
    if (saved.size > REMEMBERED_SAVES) {
      const [oldest] = saved.keys();
      if (oldest !== undefined) {
        saved.delete(oldest);
      }
    }
    return savedId;
  };

  const save = async (
    request: unknown,
    allowed: readonly SaveExtension[]
  ): Promise<SaveResult> => {
    const parsed = SaveRequest.safeParse(request);
    if (!(parsed.success && allowed.includes(parsed.data.extension))) {
      throw new DbError(
        "INVALID_FILE",
        "The file name or content is not valid."
      );
    }
    const { baseName, extension, content } = parsed.data;
    const dir = deps.dir();
    for (let n = 1; n <= MAX_SUFFIX; n += 1) {
      const fileName = candidateName(baseName, extension, n);
      const path = join(dir, fileName);
      try {
        await deps.writeExclusive(path, content);
        return { fileName, savedId: remember(path) };
      } catch (error) {
        if (!isAlreadyExists(error)) {
          throw error;
        }
      }
    }
    throw new DbError(
      "FILE_EXISTS",
      `Downloads already has ${MAX_SUFFIX} files named ${baseName}.`
    );
  };

  const reveal = (savedId: string): void => {
    const path = saved.get(savedId);
    if (!path) {
      throw new DbError("NOT_FOUND", "That file is no longer known.");
    }
    deps.reveal(path);
  };

  return { reveal, save };
};

export type Downloads = ReturnType<typeof createDownloads>;
