import { Resend } from "resend";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";

const FROM = "NinjaGym <hello@ninjagym.com>";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendMemberConfirmation({
  to,
  name,
  membershipType,
  memberId,
  paymentMethod,
}: {
  to: string;
  name: string;
  membershipType: string;
  memberId: number;
  paymentMethod: string;
}) {
  const resend = getResend();
  if (!resend || !to) return;

  const label =
    MEMBERSHIP_TYPES.find((m) => m.id === membershipType)?.label ?? membershipType;

  const cardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/qr/card/${memberId}`;

  const paymentNote =
    paymentMethod === "stripe"
      ? "Your card payment has been received."
      : paymentMethod === "cash"
      ? "Please pay at the front desk when you arrive."
      : "Your PromptPay slip is under review. Staff will approve it shortly.";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to NinjaGym, ${name}!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="color:#1a56db;font-size:28px;margin-bottom:4px">Welcome, ${name}!</h1>
        <p style="color:#555;margin-top:0">You're registered at <strong>NinjaGym — Rick Tew's Dojo, Koh Samui</strong>.</p>

        <div style="background:#f0f4ff;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0 0 6px;color:#333"><strong>Membership:</strong> ${label}</p>
          <p style="margin:0 0 6px;color:#333"><strong>Member ID:</strong> #${memberId}</p>
          <p style="margin:0;color:#333"><strong>Payment:</strong> ${paymentNote}</p>
        </div>

        <a href="${cardUrl}" style="display:block;background:#1a56db;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:12px;font-weight:bold;font-size:16px;margin:20px 0">
          View Your QR Check-In Card
        </a>

        <p style="color:#888;font-size:13px">Save your QR card to your phone home screen for quick check-in at the front desk.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px;text-align:center">NinjaGym · Koh Samui, Thailand · <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#aaa">ninjagym.com</a></p>
      </div>
    `,
  });
}

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
    morning: "Morning (9am–12pm)",
    afternoon: "Afternoon (1pm–5pm)",
    evening: "Evening (5pm–8pm)",
    weekend: "Weekend",
  };

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Birthday Booking Confirmed — ${eventDate}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="color:#1a56db;font-size:28px;margin-bottom:4px">Booking Received!</h1>
        <p style="color:#555;margin-top:0">Hi <strong>${name}</strong>, your birthday event booking at NinjaGym is in!</p>

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
        <p style="color:#aaa;font-size:12px;text-align:center">NinjaGym · Koh Samui, Thailand · <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#aaa">ninjagym.com</a></p>
      </div>
    `,
  });
}
