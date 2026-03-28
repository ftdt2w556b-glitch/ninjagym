"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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
    <div className="flex flex-col items-center justify-center min-h-dvh px-5 py-10">

      {/* Logo above the card */}
      <div className="mb-5">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={100} height={100} className="drop-shadow-xl" />
      </div>

      {/* Frosted card — makes content readable over the busy background */}
      <div className="w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl px-6 py-8">
        <h1 className="font-fredoka text-3xl text-center text-[#1a56db] mb-1">My Membership</h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          Enter your name, phone number, or email to find your QR card
        </p>

        <form onSubmit={handleLookup} className="flex flex-col gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Sarah or +66 80 000 0000"
            className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#1a56db] shadow-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? "Searching..." : "Find My QR Card"}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Link href="/join" className="text-[#ffe033] font-semibold text-sm underline drop-shadow">
          Not a member yet? Join here →
        </Link>
        <Link href="/" className="text-white/60 text-sm underline drop-shadow">← Back to Home</Link>
      </div>
    </div>
  );
}
