import { createHash } from "crypto";

/**
 * Compute the SHA-256 hex digest of an uploaded slip image.
 *
 * Used at upload time to fingerprint each slip so staff can spot when a parent
 * re-uploads the exact same image (different registration / event / shop order)
 * to claim a payment that was already used.
 *
 * Won't catch near-duplicates (re-cropped, brightness-adjusted, etc.), that
 * would need perceptual hashing. Won't catch a fresh screenshot of the same
 * underlying transaction either. But it cleanly catches the most common cheat:
 * exact-byte image reuse.
 */
export async function hashSlipFile(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  return createHash("sha256").update(buffer).digest("hex");
}
