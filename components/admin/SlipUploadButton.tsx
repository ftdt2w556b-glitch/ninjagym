"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function SlipUploadButton({ memberId }: { memberId: number }) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function compressImage(file: File, maxPx: number): Promise<File> {
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
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 1400);
      const body = new FormData();
      body.append("slip", compressed, file.name);
      const res = await fetch(`/api/members/${memberId}/slip`, { method: "POST", body });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Upload failed");
      } else {
        setDone(true);
        router.refresh();
      }
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="text-xs text-green-600 font-semibold">✓ Slip uploaded — ready to approve.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? "Uploading…" : "📎 Upload Slip for Customer"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
