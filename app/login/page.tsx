"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="public-bg min-h-dvh flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-3">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={90} height={90} className="drop-shadow-xl" />
      </div>
      <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-6">Staff Login</p>

      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="staff@ninjagym.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      <Link href="/" className="mt-6 text-white/50 text-xs underline">← Back to Home</Link>
    </div>
  );
}
