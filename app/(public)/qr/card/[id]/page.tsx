import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QRCode from "react-qr-code";
import Link from "next/link";
import Image from "next/image";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import ShareButton from "@/components/public/ShareButton";

export default async function QrCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("member_registrations")
    .select("id, name, membership_type, sessions_remaining, slip_status, kids_names, kids_count, created_at")
    .eq("id", id)
    .single();

  if (!member) notFound();

  const { data: photos } = await admin
    .from("marketing_photos")
    .select("id, file_path, caption, tags")
    .eq("member_id", Number(id))
    .eq("approved", true)
    .order("created_at", { ascending: false });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const membershipLabel =
    MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ??
    member.membership_type;

  const isApproved = member.slip_status === "approved";
  const isRejected = member.slip_status === "rejected";
  const isPending = !isApproved && !isRejected;

  const qrValue = `${siteUrl}/scanner?member=${member.id}`;
  const firstName = member.name.split(" ")[0];

  return (
    <div className="px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-white/70 text-sm hover:text-white">← Home</Link>
        <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
      </div>

      {/* Welcome hero */}
      <div className="text-center mb-5">
        <div className="text-5xl mb-2">🥷</div>
        <h1 className="font-bangers text-4xl text-[#ffe033] tracking-wide drop-shadow-lg"
          style={{ textShadow: "1px 2px 0px rgba(0,0,0,0.3)" }}>
          {isApproved ? `Welcome, ${firstName}!` : `You're Registered, ${firstName}!`}
        </h1>
        <p className="text-white/70 text-sm mt-1.5">
          Bookmark this page — it is your personal NinjaGym card
        </p>
      </div>

      {/* Payment status banners */}
      {isPending && (
        <div className="bg-white/15 border border-white/20 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">⏳</span>
          <div>
            <p className="text-white font-bold text-sm">Payment being reviewed</p>
            <p className="text-white/70 text-xs leading-relaxed">
              Your spot is reserved. Check in with staff when you arrive and they will confirm your payment.
            </p>
          </div>
        </div>
      )}
      {isRejected && (
        <div className="bg-red-500/20 border border-red-400/30 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">❌</span>
          <div>
            <p className="text-red-200 font-bold text-sm">Payment not confirmed</p>
            <p className="text-red-200/70 text-xs">Please speak to staff at the front desk.</p>
          </div>
        </div>
      )}

      {/* QR Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Card header */}
        <div className="bg-[#1a56db] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm leading-tight">Your Personal Ninja Card</p>
            <p className="text-white/60 text-xs mt-0.5">Show at the front desk to check in</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            isApproved
              ? "bg-green-400 text-green-900"
              : isRejected
              ? "bg-red-400 text-red-900"
              : "bg-yellow-300 text-yellow-900"
          }`}>
            {isApproved ? "Active" : isRejected ? "Rejected" : "Pending"}
          </span>
        </div>

        {/* Member info */}
        <div className="px-5 pt-5 pb-2">
          <h2 className="font-fredoka text-2xl text-gray-900 leading-tight">{member.name}</h2>
          <p className="text-sm text-[#1a56db] font-semibold mt-0.5">{membershipLabel}</p>
          {member.kids_names && (
            <p className="text-xs text-gray-400 mt-1">Kids: {member.kids_names}</p>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center py-6 px-5">
          <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
            <QRCode
              value={qrValue}
              size={188}
              bgColor="#ffffff"
              fgColor="#1a56db"
            />
          </div>
        </div>

        {/* Scan instruction */}
        <p className="text-center text-xs text-gray-400 -mt-3 mb-3 px-6">
          This QR code is for check-in only, not payment
        </p>

        {/* Member ID + sessions row */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Member ID</p>
            <p className="font-bold text-gray-700 text-lg">#{member.id}</p>
          </div>
          {member.sessions_remaining !== null && (
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Sessions Left</p>
              <p className="font-bold text-[#1a56db] text-2xl">{member.sessions_remaining}</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Registered</p>
            <p className="text-xs font-semibold text-gray-600">
              {new Date(member.created_at).toLocaleDateString("en-US", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400">NinjaGym, Rick Tew&apos;s Dojo, Koh Samui</p>
        </div>
      </div>

      {/* Save tip */}
      <div className="mt-4 bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center">
        <p className="text-white/80 text-sm font-semibold">📲 Save to your home screen</p>
        <p className="text-white/50 text-xs mt-0.5">
          Tap Share in your browser then &quot;Add to Home Screen&quot; for quick access at the front desk
        </p>
      </div>

      <ShareButton
        url={`${siteUrl}/qr/card/${member.id}`}
        title={`${member.name}: NinjaGym QR Card`}
      />

      {/* Approved marketing photos for this member */}
      {photos && photos.length > 0 && (
        <div className="mt-6">
          <h2 className="font-fredoka text-xl text-white drop-shadow mb-3">📸 Your NinjaGym Photos</h2>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="rounded-2xl overflow-hidden shadow-lg bg-white">
                <div className="relative aspect-square">
                  <Image
                    src={`${supabaseUrl}/storage/v1/object/public/marketing-photos/${photo.file_path}`}
                    alt={photo.caption ?? "NinjaGym action photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 480px) 50vw, 200px"
                  />
                </div>
                {photo.caption && (
                  <p className="text-xs text-gray-500 px-3 py-2 truncate">{photo.caption}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs text-center mt-3">
            Want high-res? Ask staff for a Google Drive share link.
          </p>
        </div>
      )}
    </div>
  );
}
