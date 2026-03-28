"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { Lang } from "@/lib/i18n/translations";

const content = {
  en: {
    title: "PromptPay Payment",
    subtitle: "How to pay with PromptPay",
    step1Title: "Open your banking app",
    step1Body: "Open any Thai banking app: KBank, SCB, Bangkok Bank, Krungthai, or any app with PromptPay.",
    step2Title: "Transfer to PromptPay",
    step2Body: "Send the exact amount to:",
    step3Title: "Take a screenshot",
    step3Body: "Screenshot the transfer confirmation screen showing the amount, recipient name, and transaction reference.",
    step4Title: "Upload your slip",
    step4Body: "Go back to your registration or booking form and upload the screenshot. Staff will approve it within minutes.",
    questions: "Questions?",
    questionsBody: "Show this page to staff at the front desk and they will help you.",
    registerBtn: "Register as Member",
    backBtn: "Back to Home",
  },
  ru: {
    title: "Оплата через PromptPay",
    subtitle: "Как оплатить через PromptPay",
    step1Title: "Откройте банковское приложение",
    step1Body: "Откройте любое тайское банковское приложение: KBank, SCB, Bangkok Bank, Krungthai или любое другое с поддержкой PromptPay.",
    step2Title: "Выполните перевод на PromptPay",
    step2Body: "Отправьте точную сумму на:",
    step3Title: "Сделайте скриншот",
    step3Body: "Скриншот экрана подтверждения перевода с суммой, именем получателя и номером транзакции.",
    step4Title: "Загрузите чек",
    step4Body: "Вернитесь в форму регистрации или бронирования и загрузите скриншот. Персонал подтвердит оплату в течение нескольких минут.",
    questions: "Вопросы?",
    questionsBody: "Покажите эту страницу сотруднику на ресепшене - они помогут.",
    registerBtn: "Зарегистрироваться",
    backBtn: "На главную",
  },
  th: {
    title: "ชำระเงินผ่านพร้อมเพย์",
    subtitle: "วิธีชำระเงินผ่านพร้อมเพย์",
    step1Title: "เปิดแอปธนาคาร",
    step1Body: "เปิดแอปธนาคารไทยใดก็ได้ เช่น KBank, SCB, กรุงเทพ, กรุงไทย หรือแอปที่รองรับพร้อมเพย์",
    step2Title: "โอนเงินไปยังพร้อมเพย์",
    step2Body: "ส่งจำนวนเงินที่แน่นอนไปที่:",
    step3Title: "ถ่ายภาพหน้าจอ",
    step3Body: "ถ่ายภาพหน้าจอยืนยันการโอนที่แสดงจำนวนเงิน ชื่อผู้รับ และรหัสธุรกรรม",
    step4Title: "อัปโหลดสลิป",
    step4Body: "กลับไปที่แบบฟอร์มลงทะเบียนหรือจอง แล้วอัปโหลดภาพหน้าจอ เจ้าหน้าที่จะอนุมัติภายในไม่กี่นาที",
    questions: "มีคำถาม?",
    questionsBody: "แสดงหน้านี้แก่เจ้าหน้าที่ที่เคาน์เตอร์และพวกเขาจะช่วยเหลือคุณ",
    registerBtn: "สมัครสมาชิก",
    backBtn: "กลับหน้าหลัก",
  },
  fr: {
    title: "Paiement PromptPay",
    subtitle: "Comment payer avec PromptPay",
    step1Title: "Ouvrez votre application bancaire",
    step1Body: "Ouvrez n'importe quelle application bancaire thaïlandaise : KBank, SCB, Bangkok Bank, Krungthai ou toute appli compatible PromptPay.",
    step2Title: "Transfert vers PromptPay",
    step2Body: "Envoyez le montant exact à :",
    step3Title: "Prenez une capture d'écran",
    step3Body: "Capturez l'écran de confirmation du virement indiquant le montant, le nom du destinataire et la référence de transaction.",
    step4Title: "Téléchargez votre reçu",
    step4Body: "Retournez à votre formulaire d'inscription ou de réservation et téléchargez la capture. Le personnel approuvera en quelques minutes.",
    questions: "Des questions ?",
    questionsBody: "Montrez cette page au personnel à l'accueil et ils vous aideront.",
    registerBtn: "S'inscrire comme membre",
    backBtn: "Retour à l'accueil",
  },
  he: {
    title: "תשלום PromptPay",
    subtitle: "כיצד לשלם עם PromptPay",
    step1Title: "פתח את אפליקציית הבנק שלך",
    step1Body: "פתח כל אפליקציית בנק תאילנדית: KBank, SCB, Bangkok Bank, Krungthai או כל אפליקציה עם PromptPay.",
    step2Title: "העבר אל PromptPay",
    step2Body: "שלח את הסכום המדויק אל:",
    step3Title: "צלם מסך",
    step3Body: "צלם מסך של אישור ההעברה המציג את הסכום, שם הנמען ומספר העסקה.",
    step4Title: "העלה את האסמכתא",
    step4Body: "חזור לטופס ההרשמה או ההזמנה שלך והעלה את הצילום מסך. הצוות יאשר תוך מספר דקות.",
    questions: "שאלות?",
    questionsBody: "הצג דף זה לצוות בדלפק ויעזרו לך.",
    registerBtn: "הרשמה כחבר",
    backBtn: "חזרה לדף הבית",
  },
} satisfies Record<string, {
  title: string; subtitle: string;
  step1Title: string; step1Body: string;
  step2Title: string; step2Body: string;
  step3Title: string; step3Body: string;
  step4Title: string; step4Body: string;
  questions: string; questionsBody: string;
  registerBtn: string; backBtn: string;
}>;

export default function PromptPayPage() {
  const [lang, setLang] = useState<Lang>("en");
  const c = content[lang as keyof typeof content] ?? content.en;

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-white/70 text-sm hover:text-white">← Back</Link>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-2">{c.title}</h1>
      <p className="text-white/80 text-sm mb-6">{c.subtitle}</p>

      <div className="flex flex-col gap-4">

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">1</span>
            <h2 className="font-bold text-gray-800">{c.step1Title}</h2>
          </div>
          <p className="text-sm text-gray-600">{c.step1Body}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">2</span>
            <h2 className="font-bold text-gray-800">{c.step2Title}</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">{c.step2Body}</p>
          <div className="bg-blue-50 rounded-xl px-4 py-4 text-center">
            <Image
              src="/images/promptpay-qr-small.png"
              alt="PromptPay QR Code"
              width={160}
              height={160}
              className="mx-auto mb-3 rounded-xl"
            />
            <p className="text-xs text-gray-500 mb-1">PromptPay Number</p>
            <p className="font-fredoka text-2xl text-[#1a56db] tracking-widest">0862944374</p>
            <p className="text-sm text-gray-600 mt-1">Rick Tew Co., Ltd.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">3</span>
            <h2 className="font-bold text-gray-800">{c.step3Title}</h2>
          </div>
          <p className="text-sm text-gray-600">{c.step3Body}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">4</span>
            <h2 className="font-bold text-gray-800">{c.step4Title}</h2>
          </div>
          <p className="text-sm text-gray-600">{c.step4Body}</p>
        </div>

        <div className="bg-[#ffe033] rounded-2xl p-4 shadow">
          <p className="text-sm font-bold text-[#1a56db]">{c.questions}</p>
          <p className="text-sm text-[#1a56db]">{c.questionsBody}</p>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <Link
            href="/join"
            className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 text-center shadow hover:bg-green-500 transition-colors"
          >
            {c.registerBtn}
          </Link>
          <Link
            href="/"
            className="bg-white/20 text-white font-semibold text-base rounded-2xl py-3 text-center hover:bg-white/30 transition-colors"
          >
            {c.backBtn}
          </Link>
        </div>

      </div>
    </div>
  );
}
