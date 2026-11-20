import { DbError } from "@oh-my-query/core";
import { z } from "zod";

const MAX_BASE64_LENGTH = 16_000_000;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const PngBase64 = z
  .string()
  .min(1)
  .max(MAX_BASE64_LENGTH)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);

const hasPngSignature = (bytes: Uint8Array): boolean =>
  PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);

export const decodePng = (pngBase64: unknown): Uint8Array => {
  const parsed = PngBase64.safeParse(pngBase64);
  if (!parsed.success) {
    throw new DbError("INVALID_IMAGE", "The image data is not valid.");
  }
  const bytes = new Uint8Array(Buffer.from(parsed.data, "base64"));
  if (!hasPngSignature(bytes)) {
    throw new DbError("INVALID_IMAGE", "The image is not a PNG.");
  }
  return bytes;
};
