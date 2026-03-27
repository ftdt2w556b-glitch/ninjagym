"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
    questionsBody: "Покажите эту страницу сотруднику на ресепшене — они помогут.",
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
};

export default function PromptPayPage() {
  const [lang, setLang] = useState<Lang>("en");
  const c = content[lang];

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
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-center">
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
