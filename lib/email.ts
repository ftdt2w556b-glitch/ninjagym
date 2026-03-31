import { Resend } from "resend";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import { signMemberId } from "@/lib/member-token";

const FROM        = "NinjaGym <hello@ninjagym.com>";
const BRAND_NAME  = "Rick Tew's NinjaGym";
const FOOTER_LINE = "Rick Tew's NinjaGym · Koh Samui, Thailand";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// ─── Per-language strings used in member confirmation emails ─────────────────
type EmailLang = "en" | "th" | "ru" | "fr" | "he";

const emailStrings: Record<EmailLang, {
  welcome:      (name: string) => string;
  registered:   string;
  membership:   string;
  memberId:     string;
  kids:         string;
  registered_at:string;
  payment:      string;
  viewCard:     string;
  saveHint:     string;
  payPromptPay: string;
  payCash:      string;
  payCard:      string;
  subject:      (name: string) => string;
}> = {
  en: {
    subject:      (n) => `Welcome to NinjaGym, ${n}!`,
    welcome:      (n) => `Welcome, ${n}!`,
    registered:   `You're registered at <strong>${BRAND_NAME}</strong>.`,
    membership:   "Membership",
    memberId:     "Member ID",
    kids:         "Kids",
    registered_at:"Registered",
    payment:      "Payment",
    viewCard:     "View Your Member Card",
    saveHint:     "Save your member card to your phone home screen. Your check-in PIN is shown on the card.",
    payPromptPay: "Your PromptPay slip is under review. Staff will approve it shortly.",
    payCash:      "Please pay at the front desk when you arrive.",
    payCard:      "Your card payment has been received.",
  },
  th: {
    subject:      (n) => `ยินดีต้อนรับสู่ NinjaGym, ${n}!`,
    welcome:      (n) => `ยินดีต้อนรับ, ${n}!`,
    registered:   `คุณได้ลงทะเบียนที่ <strong>${BRAND_NAME}</strong> เรียบร้อยแล้ว`,
    membership:   "โปรแกรม",
    memberId:     "รหัสสมาชิก",
    kids:         "เด็ก",
    registered_at:"เวลาลงทะเบียน",
    payment:      "การชำระเงิน",
    viewCard:     "ดูบัตรสมาชิกของคุณ",
    saveHint:     "บันทึกบัตรสมาชิกไว้ที่หน้าจอหลักของโทรศัพท์ PIN เช็คอินของคุณแสดงอยู่บนบัตร",
    payPromptPay: "สลิปพร้อมเพย์ของคุณอยู่ระหว่างการตรวจสอบ เจ้าหน้าที่จะอนุมัติเร็วๆ นี้",
    payCash:      "กรุณาชำระเงินที่เคาน์เตอร์เมื่อมาถึง",
    payCard:      "รับการชำระเงินด้วยบัตรของคุณแล้ว",
  },
  ru: {
    subject:      (n) => `Добро пожаловать в NinjaGym, ${n}!`,
    welcome:      (n) => `Добро пожаловать, ${n}!`,
    registered:   `Вы зарегистрированы в <strong>${BRAND_NAME}</strong>.`,
    membership:   "Программа",
    memberId:     "ID участника",
    kids:         "Дети",
    registered_at:"Зарегистрировано",
    payment:      "Оплата",
    viewCard:     "Открыть карту участника",
    saveHint:     "Сохраните карту участника на главный экран телефона. PIN для входа указан на карте.",
    payPromptPay: "Ваш чек PromptPay проверяется. Сотрудник подтвердит его в ближайшее время.",
    payCash:      "Пожалуйста, оплатите на стойке регистрации при прибытии.",
    payCard:      "Оплата картой получена.",
  },
  fr: {
    subject:      (n) => `Bienvenue chez NinjaGym, ${n}!`,
    welcome:      (n) => `Bienvenue, ${n}!`,
    registered:   `Vous êtes inscrit(e) à <strong>${BRAND_NAME}</strong>.`,
    membership:   "Programme",
    memberId:     "N° de membre",
    kids:         "Enfants",
    registered_at:"Inscrit le",
    payment:      "Paiement",
    viewCard:     "Voir votre carte membre",
    saveHint:     "Enregistrez votre carte membre sur l'écran d'accueil. Votre PIN de check-in est affiché sur la carte.",
    payPromptPay: "Votre reçu PromptPay est en cours de vérification. L'équipe l'approuvera bientôt.",
    payCash:      "Veuillez payer à l'accueil à votre arrivée.",
    payCard:      "Votre paiement par carte a été reçu.",
  },
  he: {
    subject:      (n) => `ברוך הבא ל-NinjaGym, ${n}!`,
    welcome:      (n) => `!ברוך הבא, ${n}`,
    registered:   `נרשמת בהצלחה ב-<strong>${BRAND_NAME}</strong>.`,
    membership:   "תוכנית",
    memberId:     "מזהה חבר",
    kids:         "ילדים",
    registered_at:"נרשם ב",
    payment:      "תשלום",
    viewCard:     "צפה בכרטיס החבר שלך",
    saveHint:     "שמור את כרטיס החבר במסך הבית של הטלפון. ה-PIN לצ'ק-אין מופיע על הכרטיס.",
    payPromptPay: "קבלת PromptPay שלך בבדיקה. הצוות יאשר אותה בקרוב.",
    payCash:      "אנא שלם בדלפק עם הגעתך.",
    payCard:      "תשלום הכרטיס התקבל.",
  },
};

// ─── Member Registration Confirmation ────────────────────────────────────────
export async function sendMemberConfirmation({
  to,
  name,
  membershipType,
  memberId,
  paymentMethod,
  kidsNames,
  kidsCount,
  registeredAt,
  pin,
  lang = "en",
}: {
  to: string;
  name: string;
  membershipType: string;
  memberId: number;
  paymentMethod: string;
  kidsNames?: string | null;
  kidsCount?: number | null;
  registeredAt?: string | null;
  pin?: number | null;
  lang?: string;
}) {
  const resend = getResend();
  if (!resend || !to) return;

  const s = emailStrings[(lang as EmailLang) in emailStrings ? (lang as EmailLang) : "en"];
  const label = MEMBERSHIP_TYPES.find((m) => m.id === membershipType)?.label ?? membershipType;
  const cardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/qr/card/${memberId}?token=${signMemberId(memberId)}`;

  const paymentNote =
    paymentMethod === "stripe" ? s.payCard :
    paymentMethod === "cash"   ? s.payCash :
                                 s.payPromptPay;

  // Format registration time
  const regTime = registeredAt
    ? new Date(registeredAt).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
      })
    : new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
      });

  // Kids row (only show if there are kids)
  const kidsRow = kidsNames
    ? `<p style="margin:0 0 6px;color:#333"><strong>${s.kids}:</strong> ${kidsNames}${kidsCount && kidsCount > 1 ? ` (${kidsCount})` : ""}</p>`
    : kidsCount
    ? `<p style="margin:0 0 6px;color:#333"><strong>${s.kids}:</strong> ${kidsCount}</p>`
    : "";

  await resend.emails.send({
    from: FROM,
    to,
    subject: s.subject(name),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="color:#1a56db;font-size:28px;margin-bottom:4px">${s.welcome(name)}</h1>
        <p style="color:#555;margin-top:0">${s.registered}</p>

        <div style="background:#f0f4ff;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0 0 6px;color:#333"><strong>${s.membership}:</strong> ${label}</p>
          <p style="margin:0 0 6px;color:#333"><strong>${s.memberId}:</strong> #${memberId}</p>
          ${kidsRow}
          <p style="margin:0 0 6px;color:#333"><strong>${s.registered_at}:</strong> ${regTime}</p>
          <p style="margin:0;color:#333"><strong>${s.payment}:</strong> ${paymentNote}</p>
        </div>

        <a href="${cardUrl}" style="display:block;background:#1a56db;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:12px;font-weight:bold;font-size:16px;margin:20px 0">
          ${s.viewCard}
        </a>

        ${pin ? `
        <div style="background:#111;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
          <p style="color:#999;font-size:11px;font-weight:bold;letter-spacing:2px;margin:0 0 8px;text-transform:uppercase">Your Check-In PIN</p>
          <p style="color:#ffe033;font-size:36px;font-weight:bold;letter-spacing:12px;margin:0;font-family:monospace">${String(pin).padStart(4,"0")}</p>
          <p style="color:#666;font-size:12px;margin:8px 0 0">Enter this at the front desk kiosk to check in</p>
        </div>
        ` : ""}

        <p style="color:#888;font-size:13px">${s.saveHint}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px;text-align:center">${FOOTER_LINE} · <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#aaa">ninjagym.com</a></p>
      </div>
    `,
  });
}

// ─── Birthday / Event Booking Confirmation ────────────────────────────────────
export async function sendEventConfirmation({
  to,
  name,
  eventDate,
  timeSlot,
  numHours,
  numKids,
  totalAmount,
  bookingId,
}: {
  to: string;
  name: string;
  eventDate: string;
  timeSlot: string;
  numHours: number;
  numKids: number;
  totalAmount: number;
  bookingId: number;
}) {
  const resend = getResend();
  if (!resend || !to) return;

  const slotLabels: Record<string, string> = {
    morning:   "Morning (9am–12pm)",
    afternoon: "Afternoon (1pm–5pm)",
    evening:   "Evening (5pm–8pm)",
    weekend:   "Weekend",
  };

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Birthday Booking Confirmed: ${eventDate}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="color:#1a56db;font-size:28px;margin-bottom:4px">Booking Received!</h1>
        <p style="color:#555;margin-top:0">Hi <strong>${name}</strong>, your birthday event booking at <strong>${BRAND_NAME}</strong> is confirmed.</p>

        <div style="background:#f0f4ff;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0 0 6px;color:#333"><strong>Date:</strong> ${eventDate}</p>
          <p style="margin:0 0 6px;color:#333"><strong>Time Slot:</strong> ${slotLabels[timeSlot] ?? timeSlot}</p>
          <p style="margin:0 0 6px;color:#333"><strong>Duration:</strong> ${numHours} hour${numHours !== 1 ? "s" : ""}</p>
          <p style="margin:0 0 6px;color:#333"><strong>Kids:</strong> ${numKids}</p>
          <p style="margin:0;color:#333"><strong>Total:</strong> ${totalAmount.toLocaleString()} THB</p>
        </div>

        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px;margin:16px 0">
          <p style="margin:0;color:#92400e;font-size:14px">⚠️ Your booking is <strong>pending payment confirmation</strong>. Staff will review your payment slip and confirm within a few hours.</p>
        </div>

        <p style="color:#888;font-size:13px">Booking ID: #${bookingId} · Questions? Reply to this email or visit us at the front desk.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px;text-align:center">${FOOTER_LINE} · <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#aaa">ninjagym.com</a></p>
      </div>
    `,
  });
}

// ─── Shop Order Confirmation ──────────────────────────────────────────────────
export async function sendShopConfirmation({
  to,
  name,
  items,
  totalAmount,
  orderId,
  paymentMethod,
}: {
  to: string;
  name: string;
  items: { name: string; qty: number; size_or_flavor: string; unit_price: number }[];
  totalAmount: number;
  orderId: number;
  paymentMethod: string;
}) {
  const resend = getResend();
  if (!resend || !to) return;

  const paymentNote =
    paymentMethod === "stripe" ? "Your card payment has been received." :
    paymentMethod === "cash"   ? "Please pay at the front desk when you pick up." :
                                 "Your PromptPay slip is under review. Staff will approve it shortly.";

  const itemRows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 8px;color:#333">${i.name} (${i.size_or_flavor})</td><td style="padding:6px 8px;color:#333;text-align:center">${i.qty}</td><td style="padding:6px 8px;color:#1a56db;text-align:right;font-weight:bold">${(i.unit_price * i.qty).toLocaleString()} THB</td></tr>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to,
    subject: `NinjaGym Store: Order #${orderId} Received`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="color:#1a56db;font-size:28px;margin-bottom:4px">Order Received!</h1>
        <p style="color:#555;margin-top:0">Hi <strong>${name}</strong>, thanks for your ${BRAND_NAME} Store order.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f0f4ff;border-radius:12px;overflow:hidden">
          <thead>
            <tr style="background:#1a56db;color:#fff">
              <th style="padding:8px;text-align:left;font-size:13px">Item</th>
              <th style="padding:8px;text-align:center;font-size:13px">Qty</th>
              <th style="padding:8px;text-align:right;font-size:13px">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:8px;font-weight:bold;color:#333">Total</td>
              <td style="padding:8px;text-align:right;font-weight:bold;color:#1a56db;font-size:16px">${totalAmount.toLocaleString()} THB</td>
            </tr>
          </tfoot>
        </table>

        <p style="color:#555;font-size:14px"><strong>Payment:</strong> ${paymentNote}</p>
        <p style="color:#888;font-size:13px">Order ID: #${orderId} · Questions? Reply to this email or visit us at the front desk.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px;text-align:center">${BRAND_NAME} Store · Koh Samui, Thailand · <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#aaa">ninjagym.com</a></p>
      </div>
    `,
  });
}
