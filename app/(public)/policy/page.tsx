"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import type { Lang } from "@/lib/i18n/translations";

/**
 * /policy — Privacy Policy
 *
 * English + Thai for v1 (PDPA-relevant audiences). Other 4 languages
 * follow once the English copy is reviewed. Static content — no DB,
 * no auth, public.
 *
 * NOTE: This is reasonable boilerplate, not legal advice. A Thai lawyer
 * should review before relying on it for PDPA compliance.
 */
const LAST_UPDATED = "May 17, 2026";

export default function PrivacyPolicyPage() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);
  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-white/70 hover:text-white text-sm">← Home</Link>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      <div className="bg-white rounded-2xl shadow p-6 leading-relaxed text-gray-700">
        {lang === "th" ? <PrivacyTh /> : <PrivacyEn />}

        <hr className="my-6 border-gray-200" />
        <p className="text-xs text-gray-400 text-center">
          <Link href="/terms" className="text-[#1a56db] hover:underline">{lang === "th" ? "เงื่อนไขการใช้บริการ" : "Terms of Service"}</Link>
          {" · "}
          <Link href="/" className="text-[#1a56db] hover:underline">{lang === "th" ? "หน้าแรก" : "Home"}</Link>
        </p>
      </div>
    </div>
  );
}

function PrivacyEn() {
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
      <p className="text-xs text-gray-400 mb-6">Last updated: {LAST_UPDATED}</p>

      <p className="mb-4">
        NinjaGym Samui (&quot;NinjaGym&quot;, &quot;we&quot;) values your privacy. This policy explains
        what information we collect through our app and at the centre, why we collect
        it, who has access, and how to exercise your rights.
      </p>
      <p className="mb-6">
        We operate in Thailand and align our practices with the Thailand Personal Data
        Protection Act B.E. 2562 (2019) (&quot;PDPA&quot;).
      </p>

      <H2>Who we are</H2>
      <P>
        NinjaGym Samui, located at Big C Mall, Bophut, Koh Samui, Thailand.<br />
        Contact for data inquiries: <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a>
      </P>

      <H2>What we collect</H2>
      <Ul>
        <li><strong>Parent / guardian:</strong> name, phone number, email address</li>
        <li><strong>Child(ren):</strong> first name(s), age, optional notes from you</li>
        <li><strong>Payment:</strong> PromptPay slip screenshot you upload, or a cash record</li>
        <li><strong>Membership PIN:</strong> a 4-digit code we generate for fast check-in</li>
        <li><strong>Attendance:</strong> each check-in (date, time, which kid, who approved)</li>
        <li><strong>Birthday bookings:</strong> event date, kid count, deposit</li>
        <li><strong>Shop orders:</strong> items purchased</li>
      </Ul>
      <P>We do not collect government ID numbers, banking details, health, or biometric data.</P>

      <H2>How we use it</H2>
      <Ul>
        <li>Approve registrations and process payments</li>
        <li>Track session balances and check in your child</li>
        <li>Send confirmation emails for bookings and registrations</li>
        <li>Issue tax invoices when requested</li>
        <li>Improve the service operationally</li>
      </Ul>
      <P>We do not sell or rent personal data. We do not share data with third parties for marketing.</P>

      <H2>Who has access</H2>
      <Ul>
        <li>Centre staff at the gym, gated by a per-staff PIN with audit logging</li>
        <li>Database hosted on Supabase (Singapore region) under their data processing terms</li>
        <li>Email delivery provider for sending confirmations</li>
        <li>Payment slip images stored in private storage</li>
      </Ul>

      <H2>Data retention</H2>
      <Ul>
        <li>Active member registrations: while you remain an active member</li>
        <li>Payment slip images: 180 days, then automatically deleted</li>
        <li>Attendance logs: 7 years (Thai tax requirement)</li>
        <li>Encrypted backups: 30 days</li>
      </Ul>

      <H2>Your rights under PDPA</H2>
      <Ul>
        <li>Access — request a copy of the data we hold about you</li>
        <li>Correction — ask us to fix inaccurate data</li>
        <li>Deletion — ask us to delete your account and associated data</li>
        <li>Withdrawal — withdraw consent for photo / video use</li>
        <li>Complaint — lodge a complaint with the Thai Personal Data Protection Committee</li>
      </Ul>
      <P>
        To exercise any of these rights, email{" "}
        <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a>{" "}
        with your registration name and phone number. We respond within 30 days.
      </P>

      <H2>Children&apos;s data</H2>
      <P>
        We collect minimal data about children — first name and age only. Parents
        register and consent on the child&apos;s behalf. We do not market directly
        to children.
      </P>

      <H2>Photos and video</H2>
      <P>
        During sessions we may take photos or video for marketing materials (website,
        social media, brochures). By registering, you consent to this use. You may
        withdraw consent at any time by emailing us; we will stop using your child&apos;s
        image going forward.
      </P>

      <H2>Cookies and tracking</H2>
      <P>The app uses essential session cookies only — authentication, staff PIN session, and language preference. No third-party analytics, advertising trackers, or social-media pixels.</P>

      <H2>Security</H2>
      <Ul>
        <li>Staff access gated by per-staff PIN with full audit log</li>
        <li>Slip images stored in private storage</li>
        <li>Database with platform-level encryption at rest</li>
        <li>180-day slip retention reduces long-term exposure</li>
      </Ul>

      <H2>Changes to this policy</H2>
      <P>
        We may update this policy from time to time. The &quot;Last updated&quot; date
        will reflect any change. Material changes will be emailed to active members.
      </P>

      <H2>Contact</H2>
      <P>
        NinjaGym Samui<br />
        Email: <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a><br />
        Phone: 086-294-4374
      </P>
    </>
  );
}

function PrivacyTh() {
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">นโยบายความเป็นส่วนตัว</h1>
      <p className="text-xs text-gray-400 mb-6">อัปเดตล่าสุด: 17 พฤษภาคม 2569</p>

      <p className="mb-4">
        NinjaGym Samui (&quot;เรา&quot;) ให้ความสำคัญกับความเป็นส่วนตัวของคุณ
        นโยบายฉบับนี้อธิบายว่าเราเก็บข้อมูลอะไรผ่านแอปและที่ศูนย์
        เก็บไปทำอะไร ใครเข้าถึงได้ และคุณจะใช้สิทธิของคุณอย่างไร
      </p>
      <p className="mb-6">
        เราดำเนินกิจการในประเทศไทยและปฏิบัติตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
      </p>

      <H2>เกี่ยวกับเรา</H2>
      <P>
        NinjaGym Samui ตั้งอยู่ที่ห้าง Big C โบ๊ผุด เกาะสมุย ประเทศไทย<br />
        ติดต่อเรื่องข้อมูลส่วนบุคคล: <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a>
      </P>

      <H2>ข้อมูลที่เราเก็บ</H2>
      <Ul>
        <li><strong>ผู้ปกครอง:</strong> ชื่อ เบอร์โทรศัพท์ อีเมล</li>
        <li><strong>เด็ก:</strong> ชื่อต้น อายุ และหมายเหตุที่คุณระบุ</li>
        <li><strong>การชำระเงิน:</strong> ภาพสลิป PromptPay ที่คุณอัปโหลด หรือบันทึกเงินสด</li>
        <li><strong>รหัส PIN สมาชิก:</strong> รหัส 4 หลักที่ระบบสร้างให้สำหรับเช็คอินเร็ว</li>
        <li><strong>การเช็คอิน:</strong> วันเวลา ชื่อเด็ก เจ้าหน้าที่ที่อนุมัติ</li>
        <li><strong>การจองงานวันเกิด:</strong> วันที่ จำนวนเด็ก และค่ามัดจำ</li>
        <li><strong>คำสั่งซื้อในร้านค้า:</strong> สินค้าที่ซื้อ</li>
      </Ul>
      <P>เราไม่เก็บเลขประจำตัวประชาชน ข้อมูลธนาคาร ข้อมูลสุขภาพ หรือข้อมูลชีวภาพ</P>

      <H2>เราใช้ข้อมูลทำอะไร</H2>
      <Ul>
        <li>อนุมัติการลงทะเบียนและประมวลผลการชำระเงิน</li>
        <li>ติดตามจำนวนเซสชันและเช็คอินเด็ก</li>
        <li>ส่งอีเมลยืนยันการจองและการลงทะเบียน</li>
        <li>ออกใบกำกับภาษีเมื่อขอ</li>
        <li>ปรับปรุงคุณภาพการให้บริการ</li>
      </Ul>
      <P>เราไม่ขายหรือให้เช่าข้อมูลส่วนบุคคล และไม่แบ่งปันข้อมูลกับบุคคลที่สามเพื่อการตลาด</P>

      <H2>ใครเข้าถึงข้อมูลได้บ้าง</H2>
      <Ul>
        <li>เจ้าหน้าที่ของศูนย์ จำกัดด้วยรหัส PIN รายบุคคลและมีบันทึกการใช้งาน</li>
        <li>ฐานข้อมูลโฮสต์อยู่บน Supabase (โซนสิงคโปร์) ภายใต้ข้อตกลงการประมวลผลข้อมูลของพวกเขา</li>
        <li>ผู้ให้บริการส่งอีเมลสำหรับยืนยันการลงทะเบียน</li>
        <li>ภาพสลิปเก็บในที่จัดเก็บแบบส่วนตัว</li>
      </Ul>

      <H2>ระยะเวลาเก็บรักษา</H2>
      <Ul>
        <li>สมาชิกที่ยังใช้งาน: ตราบเท่าที่คุณยังเป็นสมาชิก</li>
        <li>ภาพสลิป: 180 วัน หลังจากนั้นลบอัตโนมัติ</li>
        <li>บันทึกการเข้าเรียน: 7 ปี (ตามข้อกำหนดภาษีไทย)</li>
        <li>สำเนาสำรองที่เข้ารหัส: 30 วัน</li>
      </Ul>

      <H2>สิทธิของคุณตาม PDPA</H2>
      <Ul>
        <li>ขอเข้าถึงสำเนาข้อมูลที่เราเก็บไว้</li>
        <li>ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
        <li>ขอลบบัญชีและข้อมูลที่เกี่ยวข้อง</li>
        <li>ถอนความยินยอมในการใช้ภาพถ่าย / วิดีโอ</li>
        <li>ร้องเรียนต่อคณะกรรมการคุ้มครองข้อมูลส่วนบุคคลของประเทศไทย</li>
      </Ul>
      <P>
        ใช้สิทธิเหล่านี้ได้โดยส่งอีเมลมาที่{" "}
        <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a>{" "}
        พร้อมระบุชื่อและเบอร์โทรที่ใช้ลงทะเบียน เราจะตอบกลับภายใน 30 วัน
      </P>

      <H2>ข้อมูลของเด็ก</H2>
      <P>เราเก็บข้อมูลเด็กเท่าที่จำเป็น คือ ชื่อต้นและอายุเท่านั้น ผู้ปกครองเป็นผู้ลงทะเบียนและให้ความยินยอมแทน เราไม่ทำการตลาดถึงเด็กโดยตรง</P>

      <H2>ภาพถ่ายและวิดีโอ</H2>
      <P>ในช่วงเซสชันเราอาจถ่ายภาพหรือวิดีโอเพื่อใช้ในการตลาด (เว็บไซต์ โซเชียลมีเดีย โบรชัวร์) เมื่อลงทะเบียนคุณยินยอมการใช้งานนี้ คุณสามารถถอนความยินยอมได้ทุกเมื่อโดยส่งอีเมลถึงเรา เราจะหยุดใช้ภาพของลูกคุณตั้งแต่นั้นเป็นต้นไป</P>

      <H2>คุกกี้และการติดตาม</H2>
      <P>แอปใช้คุกกี้เฉพาะที่จำเป็น ได้แก่ การยืนยันตัวตน เซสชันรหัส PIN ของเจ้าหน้าที่ และค่าภาษา เราไม่ใช้ระบบวิเคราะห์ของบุคคลที่สาม โฆษณาติดตาม หรือ pixel โซเชียลมีเดีย</P>

      <H2>การรักษาความปลอดภัย</H2>
      <Ul>
        <li>เจ้าหน้าที่เข้าถึงผ่านรหัส PIN รายบุคคลพร้อมบันทึก</li>
        <li>ภาพสลิปเก็บในที่จัดเก็บแบบส่วนตัว</li>
        <li>ฐานข้อมูลเข้ารหัสในระดับแพลตฟอร์ม</li>
        <li>การลบสลิปอัตโนมัติทุก 180 วันลดความเสี่ยงระยะยาว</li>
      </Ul>

      <H2>การเปลี่ยนแปลงนโยบาย</H2>
      <P>เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว วันที่ &quot;อัปเดตล่าสุด&quot; ด้านบนจะสะท้อนการเปลี่ยนแปลง การเปลี่ยนแปลงสำคัญจะส่งอีเมลแจ้งสมาชิกที่ใช้งานอยู่</P>

      <H2>ติดต่อ</H2>
      <P>
        NinjaGym Samui<br />
        อีเมล: <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a><br />
        โทรศัพท์: 086-294-4374
      </P>
    </>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-bold text-gray-900 text-base mt-6 mb-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 mb-3 text-sm flex flex-col gap-1.5">{children}</ul>;
}
