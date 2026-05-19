"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import type { Lang } from "@/lib/i18n/translations";

/**
 * /terms. Terms of Service + House Rules + Refunds (combined).
 *
 * Keeps the existing WAIVER_RULES content from the /join modal in
 * sync with a permanently linkable page. The modal can stay where it
 * is for the registration consent step; this page is what footer
 * links, share links, and PDPA disclosures point at.
 *
 * NOTE: Reasonable boilerplate, not legal advice. A Thai lawyer
 * should review before relying on the liability language for
 * Thailand-specific enforceability.
 */
const LAST_UPDATED = "May 17, 2026";

export default function TermsPage() {
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
        {lang === "th" ? <TermsTh /> : <TermsEn />}

        <hr className="my-6 border-gray-200" />
        <p className="text-xs text-gray-400 text-center">
          <Link href="/policy" className="text-[#1a56db] hover:underline">{lang === "th" ? "นโยบายความเป็นส่วนตัว" : "Privacy Policy"}</Link>
          {" · "}
          <Link href="/" className="text-[#1a56db] hover:underline">{lang === "th" ? "หน้าแรก" : "Home"}</Link>
        </p>
      </div>
    </div>
  );
}

function TermsEn() {
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Terms of Service & House Rules</h1>
      <p className="text-xs text-gray-400 mb-6">Last updated: {LAST_UPDATED}</p>

      <p className="mb-6">
        Welcome to NinjaGym. By creating an account, registering a child, or using the
        centre, you agree to these terms.
      </p>

      <H2>1. Membership</H2>
      <Ul>
        <li>One account per family. The parent or legal guardian creates the account and accepts these terms on the child&apos;s behalf.</li>
        <li>You must provide an accurate name, phone, and email. We may suspend accounts with knowingly false information.</li>
        <li>Each family receives a 4-digit PIN for fast check-in. Keep it private.</li>
      </Ul>

      <H2>2. Code of conduct (waiver)</H2>
      <P>Participation in NinjaGym activities involves the same physical risks as any climbing wall, obstacle course, or active playground. By registering, you accept that:</P>
      <Ul>
        <li><strong>Participation is at your own risk.</strong> Areas of the centre are challenging and similar to a public playground.</li>
        <li><strong>Only kids on the mat:</strong> no parents or guardians on the training surface.</li>
        <li>Kids only enter after a <strong>NinjaGym Guide</strong> has brought them in.</li>
        <li><strong>No yelling, fighting, or disruptive behavior.</strong> Kids must follow Guides or sit out.</li>
        <li><strong>Parents are responsible</strong> for ensuring their kids follow rules and Guides.</li>
        <li>Each session is <strong>55 minutes</strong> long.</li>
        <li><strong>Do not move or disrupt equipment.</strong></li>
        <li><strong>Depart shortly after the session.</strong> No children playing in entry areas.</li>
        <li><strong>Clean up</strong> if you bring food or drinks.</li>
        <li>Sessions are <strong>&quot;learn by doing&quot;</strong> with a relaxed, fun environment.</li>
        <li><strong>By registering, you consent to photos / video</strong> being taken during sessions for marketing use.</li>
      </Ul>

      <H2>3. Payments</H2>
      <Ul>
        <li>Payments are accepted via PromptPay (with slip upload) or cash at the centre.</li>
        <li>All cash payments must be processed through our POS register. Please ensure your transaction is rung up.</li>
        <li>Single-session sales are final at the start of the session.</li>
      </Ul>

      <H2>4. Refunds and cancellations</H2>
      <Ul>
        <li><strong>All sales are final once the session has begun.</strong></li>
        <li>Birthday bookings include a <strong>฿500 refundable deposit</strong>, returned in cash after the event if there is no overtime, equipment damage, or extra cleanup needed.</li>
        <li>Cash birthday bookings must be arranged well in advance at the centre, not on the event day.</li>
        <li>Bulk session packages do not expire but cannot be transferred between families.</li>
      </Ul>

      <H2>5. Account suspension</H2>
      <P>We reserve the right to suspend or terminate an account for:</P>
      <Ul>
        <li>Inappropriate behavior by parent or child</li>
        <li>Repeated complaints from other families</li>
        <li>Unpaid balances</li>
        <li>Submitting falsified payment slips</li>
      </Ul>

      <H2>6. Liability disclaimer</H2>
      <P>NinjaGym is not liable for injuries sustained during regular participation in activities. Parents and guardians acknowledge the inherent physical risk of climbing, jumping, and similar activities. Our liability is limited to gross negligence or willful misconduct on our part.</P>

      <H2>7. Photos and video</H2>
      <P>By registering, you consent to NinjaGym using photos or video taken at the centre in marketing materials (website, social media, brochures). You may withdraw consent at any time by emailing <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a>.</P>

      <H2>8. Member PIN</H2>
      <P>Your 4-digit PIN is private. Sharing it allows others to check in under your account; we are not responsible for usage by anyone you share the PIN with.</P>

      <H2>9. Changes to terms</H2>
      <P>We may update these terms from time to time. The &quot;Last updated&quot; date at the top will reflect any change. Continued use of the centre after a material change indicates acceptance.</P>

      <H2>10. Governing law</H2>
      <P>These terms are governed by the laws of Thailand.</P>

      <H2>Contact</H2>
      <P>
        Rick Tew&apos;s NinjaGym, operated by <strong>Rick Tew Co., Ltd.</strong><br />
        Big C Mall, Bophut, Koh Samui, Thailand<br />
        Email: <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a><br />
        Phone: 082-626-5991
      </P>
    </>
  );
}

function TermsTh() {
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">เงื่อนไขการใช้บริการและกฎของศูนย์</h1>
      <p className="text-xs text-gray-400 mb-6">อัปเดตล่าสุด: 17 พฤษภาคม 2569</p>

      <p className="mb-6">ยินดีต้อนรับสู่ NinjaGym การสร้างบัญชี ลงทะเบียนเด็ก หรือใช้บริการที่ศูนย์ของเรา ถือเป็นการยอมรับเงื่อนไขเหล่านี้</p>

      <H2>1. การเป็นสมาชิก</H2>
      <Ul>
        <li>หนึ่งครอบครัวต่อหนึ่งบัญชี ผู้ปกครองหรือผู้ดูแลตามกฎหมายเป็นผู้สร้างบัญชีและยอมรับเงื่อนไขแทนเด็ก</li>
        <li>กรุณาให้ชื่อ เบอร์โทร และอีเมลที่ถูกต้อง เราอาจระงับบัญชีที่ให้ข้อมูลเท็จโดยจงใจ</li>
        <li>แต่ละครอบครัวจะได้รับ PIN 4 หลักสำหรับเช็คอินเร็ว กรุณาเก็บเป็นความลับ</li>
      </Ul>

      <H2>2. กฎความประพฤติ (Waiver)</H2>
      <P>การเข้าร่วมกิจกรรมของ NinjaGym มีความเสี่ยงทางกายภาพเช่นเดียวกับกำแพงปีนป่าย สนามอุปสรรค หรือสนามเด็กเล่น เมื่อลงทะเบียน คุณยอมรับว่า:</P>
      <Ul>
        <li><strong>การเข้าร่วมเป็นความเสี่ยงของคุณเอง</strong> พื้นที่ในศูนย์มีความท้าทายและคล้ายสนามเด็กเล่น</li>
        <li><strong>เฉพาะเด็กเท่านั้นที่ขึ้นเสื่อ</strong> ผู้ปกครองไม่ขึ้นพื้นฝึก</li>
        <li>เด็กจะเข้าพื้นที่ฝึกได้ก็ต่อเมื่อ <strong>เจ้าหน้าที่ NinjaGym</strong> นำเข้าไป</li>
        <li><strong>ห้ามตะโกน ทะเลาะ หรือก่อความวุ่นวาย</strong> เด็กต้องปฏิบัติตามคำแนะนำของเจ้าหน้าที่ ไม่เช่นนั้นจะถูกพักให้นั่งนอกพื้นที่</li>
        <li><strong>ผู้ปกครองมีหน้าที่</strong> ดูแลให้เด็กปฏิบัติตามกฎและเจ้าหน้าที่</li>
        <li>แต่ละเซสชันยาว <strong>55 นาที</strong></li>
        <li><strong>ห้ามเคลื่อนย้ายหรือรบกวนอุปกรณ์</strong></li>
        <li><strong>กรุณาออกจากศูนย์ทันทีหลังเซสชัน</strong> ไม่อนุญาตให้เด็กเล่นในพื้นที่ทางเข้า</li>
        <li>หากนำอาหารหรือเครื่องดื่มเข้ามา <strong>กรุณาเก็บกวาดด้วยตนเอง</strong></li>
        <li>เซสชันเน้น <strong>&quot;เรียนรู้ผ่านการทำ&quot;</strong> ในบรรยากาศผ่อนคลายและสนุก</li>
        <li><strong>เมื่อลงทะเบียน คุณยินยอมให้ถ่ายภาพ / วิดีโอ</strong> ระหว่างเซสชันเพื่อใช้ในการตลาด</li>
      </Ul>

      <H2>3. การชำระเงิน</H2>
      <Ul>
        <li>รับชำระผ่าน PromptPay (อัปโหลดสลิป) หรือเงินสดที่ศูนย์</li>
        <li>การชำระเงินสดทุกรายการต้องผ่านระบบ POS กรุณาตรวจสอบให้แน่ใจว่าการชำระเงินถูกบันทึก</li>
        <li>การขายแบบเซสชันเดี่ยวถือว่าสมบูรณ์เมื่อเซสชันเริ่ม</li>
      </Ul>

      <H2>4. การคืนเงินและยกเลิก</H2>
      <Ul>
        <li><strong>ไม่มีการคืนเงินเมื่อเซสชันเริ่มแล้ว</strong></li>
        <li>การจองงานวันเกิดมี <strong>ค่ามัดจำคืนได้ ฿500</strong> คืนเป็นเงินสดหลังงาน หากไม่มีการเกินเวลา ความเสียหายของอุปกรณ์ หรือการทำความสะอาดเพิ่มเติม</li>
        <li>การจองงานวันเกิดด้วยเงินสดต้องทำล่วงหน้าที่ศูนย์ ไม่ใช่ในวันงาน</li>
        <li>แพ็คเกจเซสชันแบบเหมาไม่หมดอายุ แต่ไม่สามารถโอนระหว่างครอบครัวได้</li>
      </Ul>

      <H2>5. การระงับบัญชี</H2>
      <P>เราขอสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีในกรณี:</P>
      <Ul>
        <li>พฤติกรรมไม่เหมาะสมของผู้ปกครองหรือเด็ก</li>
        <li>มีข้อร้องเรียนซ้ำจากครอบครัวอื่น</li>
        <li>ค้างชำระเงิน</li>
        <li>ส่งสลิปการชำระเงินปลอม</li>
      </Ul>

      <H2>6. ข้อจำกัดความรับผิด</H2>
      <P>NinjaGym ไม่รับผิดชอบต่อการบาดเจ็บที่เกิดขึ้นระหว่างการเข้าร่วมกิจกรรมปกติ ผู้ปกครองยอมรับความเสี่ยงทางกายภาพในการปีน กระโดด และกิจกรรมที่คล้ายคลึงกัน ความรับผิดของเราจำกัดเฉพาะกรณีที่เราประมาทเลินเล่ออย่างร้ายแรงหรือกระทำโดยจงใจ</P>

      <H2>7. ภาพถ่ายและวิดีโอ</H2>
      <P>เมื่อลงทะเบียน คุณยินยอมให้ NinjaGym ใช้ภาพถ่ายหรือวิดีโอจากที่ศูนย์ในสื่อการตลาด (เว็บไซต์ โซเชียลมีเดีย โบรชัวร์) คุณสามารถถอนความยินยอมได้ทุกเมื่อ โดยส่งอีเมลถึง <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a></P>

      <H2>8. รหัส PIN สมาชิก</H2>
      <P>PIN 4 หลักของคุณเป็นข้อมูลส่วนตัว การแบ่งปันจะทำให้ผู้อื่นสามารถเช็คอินด้วยบัญชีของคุณ เราไม่รับผิดชอบต่อการใช้งานของผู้ที่คุณแบ่งปัน PIN ด้วย</P>

      <H2>9. การเปลี่ยนแปลงเงื่อนไข</H2>
      <P>เราอาจปรับปรุงเงื่อนไขนี้เป็นครั้งคราว วันที่ &quot;อัปเดตล่าสุด&quot; ด้านบนจะสะท้อนการเปลี่ยนแปลง การใช้บริการต่อไปหลังการเปลี่ยนแปลงสำคัญถือเป็นการยอมรับ</P>

      <H2>10. กฎหมายที่ใช้บังคับ</H2>
      <P>เงื่อนไขเหล่านี้อยู่ภายใต้กฎหมายของประเทศไทย</P>

      <H2>ติดต่อ</H2>
      <P>
        Rick Tew&apos;s NinjaGym ดำเนินงานโดย <strong>บริษัท ริค ทิว จำกัด (Rick Tew Co., Ltd.)</strong><br />
        ห้าง Big C โบ๊ผุด เกาะสมุย ประเทศไทย<br />
        อีเมล: <a className="text-[#1a56db] hover:underline" href="mailto:info@ricktew.com">info@ricktew.com</a><br />
        โทรศัพท์: 082-626-5991
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
