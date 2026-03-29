"use client";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/useLanguage";

export default function PublicPageHeader({
  backHref = "/",
  right,
}: {
  backHref?: string;
  right?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="text-white/70 text-sm hover:text-white">
          {t.back}
        </Link>
        <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
