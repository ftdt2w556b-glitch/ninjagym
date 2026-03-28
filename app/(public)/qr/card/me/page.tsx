"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function MyMembershipPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const q = query.trim();

    const { data } = await supabase
      .from("member_registrations")
      .select("id")
      .or(`phone.ilike.%${q}%,email.ilike.%${q}%,name.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    setLoading(false);

    if (data?.id) {
      router.push(`/qr/card/${data.id}`);
    } else {
      setError("No membership found. Try your phone number, email, or full name.");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 py-10 text-white">
      <div className="mb-6">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={90} height={90} />
      </div>
      <h1 className="font-fredoka text-3xl text-center drop-shadow mb-1">Find My Membership</h1>
      <p className="text-white/70 text-sm text-center mb-8">Enter your name, phone, or email</p>

      <form onSubmit={handleLookup} className="w-full flex flex-col gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Sarah or +66 80 000 0000"
          className="w-full rounded-2xl px-4 py-4 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#ffe033] shadow-lg"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
        >
          {loading ? "Searching..." : "Find My QR Card 🥷"}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-red-500/20 border border-red-400/30 text-red-100 rounded-xl px-4 py-3 text-sm text-center">
          {error}
        </div>
      )}

      <a href="/" className="mt-8 text-white/40 text-sm underline">← Back to Home</a>
    </div>
  );
}
