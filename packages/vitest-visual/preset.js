import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

export function previewAnnotations(entry = []) {
  return [...entry, join(dir, "src", "preview.ts")];
}
