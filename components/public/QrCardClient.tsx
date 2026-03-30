"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "react-qr-code";
import ShareButton from "@/components/public/ShareButton";
import TopUpSection from "@/components/public/TopUpSection";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/useLanguage";

interface CheckIn {
  id: number;
  check_in_at: string;
  notes: string | null;
  member_id?: number;
}

interface Photo {
  id: number;
  file_path: string;
  caption: string | null;
  tags: string[] | null;
}

interface ActivePackage {
  id: number;
  membership_type: string;
  membership_label: string;
  sessions_remaining: number | null;
  created_at: string;
}

interface Props {
  member: {
    id: number;
    name: string;
    phone: string | null;
    email?: string | null;
    membership_type: string;
    sessions_remaining: number | null;
    slip_status: string;
    kids_names: string | null;
    kids_count: number | null;
    created_at: string;
  };
  membershipLabel: string;
  siteUrl: string;
  supabaseUrl: string;
  fromAdmin: boolean;
  checkIns: CheckIn[];
  photos: Photo[];
  activePackages: ActivePackage[];
}

export default function QrCardClient({
  member,
  membershipLabel,
  siteUrl,
  supabaseUrl,
  fromAdmin,
  checkIns,
  photos,
  activePackages,
}: Props) {
  const { t, lang, setLang } = useLanguage();

  const isApproved = member.slip_status === "approved";
  const isRejected = member.slip_status === "rejected";
  const isPending  = !isApproved && !isRejected;
  const firstName  = member.name.split(" ")[0];

  // Multi-package selection — default to first active package, or parent
  const defaultId = activePackages.length > 0 ? activePackages[0].id : member.id;
  const [selectedId, setSelectedId] = useState<number>(defaultId);

  const selectedPkg = activePackages.find((p) => p.id === selectedId) ?? activePackages[0];
  const hasMultiple = activePackages.length > 1;

  // QR code points to the selected package's registration
  const qrValue = `${siteUrl}/scanner?member=${selectedId}`;

  return (
    <div className="px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {fromAdmin ? (
            <Link href="/admin/members" className="text-white/70 text-sm hover:text-white">
              ← Members
            </Link>
          ) : (
            <Link href="/" className="text-white/70 text-sm hover:text-white">
              {t.back}
            </Link>
          )}
          <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
        </div>
        <LanguageSwitcher current={lang} onChange={setLang} />
      </div>

      {/* Welcome hero */}
      <div className="text-center mb-5">
        <div className="text-5xl mb-2">🥷</div>
        <h1
          className="font-bangers text-4xl text-[#ffe033] tracking-wide drop-shadow-lg"
          style={{ textShadow: "1px 2px 0px rgba(0,0,0,0.3)" }}
        >
          {t.qrWelcome} {firstName}!
        </h1>
        <p className="text-white/70 text-sm mt-1.5">
          This is your permanent member card
        </p>
        <p className="text-white/45 text-xs mt-1">
          Lost this link? Find it again at{" "}
          <Link href="/my-membership" className="underline hover:text-white/70">
            {t.myMembershipTitle}
          </Link>
        </p>
      </div>

      {/* Payment status banners */}
      {isPending && (
        <div className="bg-white/15 border border-white/20 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">⏳</span>
          <div>
            <p className="text-white font-bold text-sm">{t.statusPaymentReview}</p>
            <p className="text-white/70 text-xs leading-relaxed">{t.statusPaymentNote}</p>
          </div>
        </div>
      )}
      {isRejected && (
        <div className="bg-red-500/20 border border-red-400/30 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">❌</span>
          <div>
            <p className="text-red-200 font-bold text-sm">{t.statusNotConfirmed}</p>
            <p className="text-red-200/70 text-xs">{t.statusSpeak}</p>
          </div>
        </div>
      )}

      {/* QR Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Card header */}
        <div className="bg-[#1a56db] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm leading-tight">{t.qrCardTitle}</p>
            <p className="text-white/60 text-xs mt-0.5">{t.qrCardSubtitle}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            isApproved
              ? "bg-green-400 text-green-900"
              : isRejected
              ? "bg-red-400 text-red-900"
              : "bg-yellow-300 text-yellow-900"
          }`}>
            {isApproved ? t.statusActive : isRejected ? t.statusRejected : t.statusPending}
          </span>
        </div>

        {/* Member info */}
        <div className="px-5 pt-5 pb-2">
          <h2 className="font-fredoka text-2xl text-gray-900 leading-tight">{member.name}</h2>
          {/* Show selected package label, or default membership label */}
          <p className="text-sm text-[#1a56db] font-semibold mt-0.5">
            {selectedPkg ? selectedPkg.membership_label : membershipLabel}
          </p>
          {member.kids_names && (
            <p className="text-xs text-gray-400 mt-1">{t.qrKids}: {member.kids_names}</p>
          )}
        </div>

        {/* Multi-package selector */}
        {hasMultiple && (
          <div className="px-5 pb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Today&apos;s Program
            </p>
            <div className="flex flex-col gap-1.5">
              {activePackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedId(pkg.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    selectedId === pkg.id
                      ? "border-[#1a56db] bg-blue-50"
                      : "border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    selectedId === pkg.id ? "text-[#1a56db]" : "text-gray-700"
                  }`}>
                    {pkg.membership_label}
                  </span>
                  <span className="flex items-center gap-2">
                    {pkg.sessions_remaining !== null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pkg.sessions_remaining <= 2
                          ? "bg-orange-100 text-orange-600"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {pkg.sessions_remaining} left
                      </span>
                    )}
                    {selectedId === pkg.id && (
                      <span className="text-[#1a56db] text-sm">✓</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Select the program you&apos;re using today — the QR code will update
            </p>
          </div>
        )}

        {/* QR Code */}
        <div className="flex justify-center py-6 px-5">
          <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
            <QRCode value={qrValue} size={188} bgColor="#ffffff" fgColor="#1a56db" />
          </div>
        </div>

        {/* Scan instruction */}
        <p className="text-center text-xs text-gray-400 -mt-3 mb-3 px-6">
          {t.qrCardNote}
        </p>

        {/* Member ID + sessions row */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t.qrMemberId}</p>
            <p className="font-bold text-gray-700 text-lg">#{member.id}</p>
          </div>
          {selectedPkg?.sessions_remaining !== null && selectedPkg?.sessions_remaining !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{t.qrSessionsLeft}</p>
              <p className={`font-bold text-2xl ${
                selectedPkg.sessions_remaining <= 2 ? "text-orange-500" : "text-[#1a56db]"
              }`}>
                {selectedPkg.sessions_remaining}
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t.qrRegistered}</p>
            <p className="text-xs font-semibold text-gray-600">
              {new Date(member.created_at).toLocaleDateString("en-US", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400">Rick Tew&apos;s NinjaGym</p>
          <span className="sr-only">Koh Samui, Thailand</span>
        </div>
      </div>

      {/* Save tip */}
      <div className="mt-4 bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center">
        <p className="text-white/80 text-sm font-semibold">📲 {t.qrSaveHint}</p>
        <p className="text-white/50 text-xs mt-0.5">
          {t.qrSaveHintBold}
        </p>
      </div>

      <ShareButton
        url={`${siteUrl}/qr/card/${member.id}`}
        title={`${member.name}: NinjaGym QR Card`}
      />

      {/* Top-up / Continue Training / Recent Check-ins */}
      {isApproved && (
        <TopUpSection
          memberId={member.id}
          memberName={member.name}
          memberPhone={member.phone ?? null}
          memberEmail={member.email ?? null}
          currentType={member.membership_type}
          defaultKids={member.kids_count ?? 1}
          recentCheckIns={checkIns}
          activePackages={activePackages}
        />
      )}

      {/* Approved marketing photos */}
      {photos.length > 0 && (
        <div className="mt-6">
          <h2 className="font-fredoka text-xl text-white drop-shadow mb-3">📸 {t.qrPhotos}</h2>
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
          <p className="text-white/50 text-xs text-center mt-3">{t.qrPhotosHiRes}</p>
        </div>
      )}
    </div>
  );
}
