"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface Photo {
  id: number;
  file_path: string;
  caption: string | null;
  member_id: number | null;
  booking_id: number | null;
  approved: boolean;
  tags: string[] | null;
  created_at: string;
  uploader: { name: string | null } | null;
}

interface Member { id: number; name: string; kids_names: string | null; }

interface Props {
  photos: Photo[];
  members: Member[];
  supabaseUrl: string;
}

function photoUrl(supabaseUrl: string, filePath: string) {
  return `${supabaseUrl}/storage/v1/object/public/marketing-photos/${filePath}`;
}

function memberLabel(m: Member): string {
  return m.kids_names ? `${m.name} (${m.kids_names})` : m.name;
}

export default function PhotoManager({ photos: initial, members, supabaseUrl }: Props) {
  const [photos, setPhotos] = useState(initial);
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [memberId, setMemberId] = useState("");
  // Per-photo member assignment for the pending review flow
  const [photoMembers, setPhotoMembers] = useState<Record<number, string>>(() =>
    Object.fromEntries(initial.filter(p => p.member_id).map(p => [p.id, String(p.member_id)]))
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = photos.filter(p => !p.approved);
  const approved = photos.filter(p => p.approved);
  const tabPhotos = tab === "pending" ? pending : approved;

  // Unique tags across the current tab, sorted alphabetically
  const availableTags = Array.from(
    new Set(tabPhotos.flatMap(p => p.tags ?? []))
  ).sort();

  // Reset tag filter when switching tabs
  function handleTabChange(t: "pending" | "approved") {
    setTab(t);
    setSelectedTag(null);
  }

  const shown = selectedTag
    ? tabPhotos.filter(p => p.tags?.includes(selectedTag))
    : tabPhotos;

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr("");

    const body = new FormData();
    body.append("photo", file);
    if (caption) body.append("caption", caption);
    if (tags) body.append("tags", tags);
    if (memberId) body.append("member_id", memberId);

    const res = await fetch("/api/photos", { method: "POST", body });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setUploadErr(data.error ?? "Upload failed");
      return;
    }

    // Optimistic add to pending — use the server-generated file_path so the image URL is correct
    setPhotos(prev => [{
      id: data.id,
      file_path: data.file_path,
      caption: caption || null,
      member_id: memberId ? Number(memberId) : null,
      booking_id: null,
      approved: false,
      tags: tags ? tags.split(",").map(t => t.trim()) : null,
      created_at: new Date().toISOString(),
      uploader: { name: "You" },
    }, ...prev]);

    setCaption(""); setTags(""); setMemberId("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleAction(id: number, action: "approve" | "unapprove" | "delete") {
    const member_id = action === "approve" && photoMembers[id] ? Number(photoMembers[id]) : undefined;
    const res = await fetch("/api/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, member_id }),
    });
    if (!res.ok) return;

    if (action === "delete") {
      setPhotos(prev => prev.filter(p => p.id !== id));
    } else {
      setPhotos(prev => prev.map(p =>
        p.id === id
          ? { ...p, approved: action === "approve", member_id: member_id ?? p.member_id }
          : p
      ));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upload form */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="font-bold text-gray-800 mb-4">Upload Action Shot</h2>
        <form onSubmit={handleUpload} className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            required
            className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Caption</label>
              <input value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="e.g. Kids climbing wall"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (comma separated)</label>
              <input value={tags} onChange={e => setTags(e.target.value)}
                placeholder="e.g. birthday, climbing"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tag a Member (optional)</label>
              <select value={memberId} onChange={e => setMemberId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                <option value="">None</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{memberLabel(m)}</option>
                ))}
              </select>
            </div>
          </div>
          {uploadErr && <p className="text-red-500 text-sm">{uploadErr}</p>}
          <button type="submit" disabled={uploading}
            className="bg-[#1a56db] text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
            {uploading ? "Uploading..." : "📸 Upload Photo"}
          </button>
        </form>
      </div>

      {/* Gallery tabs */}
      <div>
        <div className="flex gap-2 mb-3">
          {(["pending", "approved"] as const).map(t => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === t ? "bg-[#1a56db] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              {t === "pending" ? `⏳ Pending (${pending.length})` : `✅ Approved (${approved.length})`}
            </button>
          ))}
        </div>

        {/* Tag filter bar — only shown when tags exist */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                selectedTag === null
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              All ({tabPhotos.length})
            </button>
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  selectedTag === tag
                    ? "bg-[#1a56db] text-white"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}>
                {tag} ({tabPhotos.filter(p => p.tags?.includes(tag)).length})
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow">
            No {tab} photos yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {shown.map(photo => (
              <div key={photo.id} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="relative aspect-square bg-gray-100">
                  <Image
                    src={photoUrl(supabaseUrl, photo.file_path)}
                    alt={photo.caption ?? "Marketing photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                <div className="p-3">
                  {photo.caption && (
                    <p className="text-xs text-gray-700 font-medium mb-1 truncate">{photo.caption}</p>
                  )}
                  {photo.tags && photo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {photo.tags.map(tag => (
                        <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mb-2">by {photo.uploader?.name ?? "Staff"}</p>

                  {/* Pending: member assignment dropdown */}
                  {!photo.approved && (
                    <select
                      value={photoMembers[photo.id] ?? ""}
                      onChange={e => setPhotoMembers(prev => ({ ...prev, [photo.id]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-[#1a56db] text-gray-700"
                    >
                      <option value="">No member</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{memberLabel(m)}</option>
                      ))}
                    </select>
                  )}

                  {/* Approved: show assigned member (read-only) */}
                  {photo.approved && photo.member_id && (
                    <p className="text-xs text-[#1a56db] font-medium mb-2 truncate">
                      → {memberLabel(members.find(m => m.id === photo.member_id) ?? { id: 0, name: "Member", kids_names: null })}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {photo.approved ? (
                      <button onClick={() => handleAction(photo.id, "unapprove")}
                        className="flex-1 text-xs bg-yellow-100 text-yellow-700 py-1.5 rounded-lg hover:bg-yellow-200 transition-colors font-semibold">
                        Unapprove
                      </button>
                    ) : (
                      <button onClick={() => handleAction(photo.id, "approve")}
                        className="flex-1 text-xs bg-green-100 text-green-700 py-1.5 rounded-lg hover:bg-green-200 transition-colors font-semibold">
                        ✓ Approve
                      </button>
                    )}
                    <button onClick={() => { if (confirm("Delete this photo?")) handleAction(photo.id, "delete"); }}
                      className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors font-semibold">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
