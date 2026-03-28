"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function MyMembershipPage() {
  const router = useRouter();
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/find-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Not found.");
      } else {
        router.push(`/qr/card/${data.id}`);
      }
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5 py-10">

      {/* Logo above the card */}
      <div className="mb-5">
        <Image
          src="/images/logo_small.png"
          alt="NinjaGym"
          width={100}
          height={100}
          className="drop-shadow-xl"
          priority
        />
      </div>

      {/* Frosted card */}
      <div className="w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl px-6 py-8">
        <h1 className="font-fredoka text-3xl text-center text-[#1a56db] mb-1">My Membership</h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          Enter your registered name and phone number to find your QR card.
        </p>

        <form onSubmit={handleLookup} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              required
              className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#1a56db] shadow-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0862944374"
              required
              className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#1a56db] shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:brightness-110 transition-all disabled:opacity-50 mt-1"
          >
            {loading ? "Searching..." : "Find My QR Card"}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
            {error}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-5">
          Both name and phone must match your registration exactly.
        </p>
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
