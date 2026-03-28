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

  const membershipLabel =
    MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ??
    member.membership_type;

  const isPending = member.slip_status !== "approved";
  const qrValue = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/scanner?member=${member.id}`;

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <Link href="/" className="text-white/70 text-sm hover:text-white">← Home</Link>
      </div>

      {/* Payment pending warning */}
      {isPending && (
        <div className="bg-yellow-400 text-yellow-900 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2 shadow">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-bold text-sm">Payment Pending</p>
            <p className="text-xs">Your payment is being reviewed. Check in with staff when you arrive.</p>
          </div>
        </div>
      )}

      {/* QR Card */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Blue header */}
        <div className="bg-[#1a56db] px-4 py-3 text-center">
          <p className="font-bangers text-[#ffe033] tracking-widest text-sm">
            CHECK-IN QR CODE, NOT A PAYMENT CODE
          </p>
        </div>

        {/* Member info */}
        <div className="px-5 pt-5 pb-2">
          <h1 className="font-fredoka text-2xl text-gray-900">{member.name}</h1>
          <p className="text-sm text-gray-500">{membershipLabel}</p>
          {member.kids_names && (
            <p className="text-xs text-gray-400 mt-1">Kids: {member.kids_names}</p>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center py-6 px-5">
          <div className="p-3 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
            <QRCode
              value={qrValue}
              size={200}
              bgColor="#ffffff"
              fgColor="#1a56db"
            />
          </div>
        </div>

        {/* Member ID + sessions */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Member ID</p>
            <p className="font-bold text-gray-700">#{member.id}</p>
          </div>
          {member.sessions_remaining !== null && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Sessions Left</p>
              <p className="font-bold text-[#1a56db] text-lg">{member.sessions_remaining}</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-gray-400">Status</p>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              member.slip_status === "approved"
                ? "bg-green-100 text-green-700"
                : member.slip_status === "rejected"
                ? "bg-red-100 text-red-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
              {member.slip_status === "approved"
                ? "Active"
                : member.slip_status === "rejected"
                ? "Rejected"
                : "Pending"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400">NinjaGym, Rick Tew&apos;s Dojo, Koh Samui</p>
          <p className="text-xs text-gray-400">Show this QR code at the front desk to check in</p>
        </div>
      </div>

      <ShareButton
        url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/qr/card/${member.id}`}
        title={`${member.name}: NinjaGym QR Card`}
      />

      <div className="mt-4 text-center">
        <p className="text-white/60 text-xs">Save this page to your phone home screen for quick access</p>
      </div>

      {/* Approved marketing photos for this member */}
      {photos && photos.length > 0 && (
        <div className="mt-6">
          <h2 className="font-fredoka text-xl text-white drop-shadow mb-3">📸 Your NinjaGym Photos</h2>
          <div className="grid grid-cols-2 gap-3">
            {photos.map(photo => (
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
