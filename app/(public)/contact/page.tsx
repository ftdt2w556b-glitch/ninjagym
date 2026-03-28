"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PublicPageHeader from "@/components/public/PublicPageHeader";

const SUBJECTS = [
  "General Question",
  "Book a Session",
  "Birthday / Event Enquiry",
  "Membership Enquiry",
  "List a Business / Partnership",
  "Report an Issue",
  "Other",
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 py-6">
      <PublicPageHeader />

      {/* Contact card */}
      <div className="bg-[#0f1e2e] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🥷</span>
            <h1 className="font-fredoka text-2xl text-white">Get in Touch</h1>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">
            Have a question? Want to book a session or event? We would love to hear from you.
          </p>
        </div>

        {sent ? (
          <div className="px-6 pb-8 pt-4 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="font-fredoka text-xl text-white mb-2">Message Sent!</h2>
            <p className="text-white/60 text-sm mb-6">
              Thanks for reaching out. We will get back to you as soon as possible.
            </p>
            <Link
              href="/"
              className="inline-block bg-[#1a56db] text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-4">
            {/* Name + Email row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  className="w-full bg-[#1a2d40] text-white placeholder-white/30 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full bg-[#1a2d40] text-white placeholder-white/30 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
                Subject
              </label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full bg-[#1a2d40] text-white border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              >
                <option value="">Select a subject...</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us how we can help..."
                className="w-full bg-[#1a2d40] text-white placeholder-white/30 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/30 text-red-300 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-[#38bdf8] hover:bg-sky-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-base transition-colors shadow-lg"
            >
              {sending ? "Sending..." : "Send Message"}
            </button>

            <p className="text-white/30 text-xs text-center">
              Based on Koh Samui, Surat Thani, Thailand
            </p>
          </form>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-white/40 text-sm underline">Back to Home</Link>
      </div>
    </div>
  );
}
