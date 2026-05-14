/**
 * Client-side image compression for slip uploads.
 *
 * Why: Vercel serverless functions cap request bodies at ~4.5 MB. A raw camera
 * photo on a modern phone is often 5-10 MB, which makes the upload hit 413
 * Request Entity Too Large and the client sees the cryptic "Unexpected token
 * 'R' is not valid JSON" because the 413 page is plain text, not JSON.
 *
 * This shrinks an uploaded slip image to a max dimension (default 1400 px) at
 * JPEG quality 0.82 before it goes over the wire. Falls through with the
 * original file if the image can't be decoded (non-image, corrupt, etc).
 */
export async function compressImage(file: File, maxPx: number = 1400): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Read a fetch Response safely, returning JSON if the body is JSON or a plain
 * text error if the server returned HTML / plain text (e.g. Vercel's 413 page).
 * Prevents the "Unexpected token 'R' is not valid JSON" trap.
 */
export async function safeJson(res: Response): Promise<{ ok: boolean; data: Record<string, unknown> | null; error: string | null }> {
  const text = await res.text();
  try {
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      return { ok: false, data, error: (data?.error as string | undefined) ?? res.statusText ?? "Request failed" };
    }
    return { ok: true, data, error: null };
  } catch {
    // Body isn't JSON — usually a Vercel error page (413, 504, etc.)
    const friendly =
      res.status === 413 ? "File is too large. Please use a smaller image (under 4 MB)."
      : res.status === 504 ? "Server timeout. Please try again."
      : `Server returned an unexpected response (${res.status}).`;
    return { ok: false, data: null, error: friendly };
  }
}
