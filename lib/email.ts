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
    paymentMethod === "stripe"
      ? "Your card payment has been received."
      : paymentMethod === "cash"
      ? "Please pay at the front desk when you pick up."
      : "Your PromptPay slip is under review. Staff will approve it shortly.";

  const itemRows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 8px;color:#333">${i.name} (${i.size_or_flavor})</td><td style="padding:6px 8px;color:#333;text-align:center">${i.qty}</td><td style="padding:6px 8px;color:#1a56db;text-align:right;font-weight:bold">${(i.unit_price * i.qty).toLocaleString()} THB</td></tr>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to,
    subject: `NinjaGym Store — Order #${orderId} Received`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="color:#1a56db;font-size:28px;margin-bottom:4px">Order Received!</h1>
        <p style="color:#555;margin-top:0">Hi <strong>${name}</strong>, thanks for your NinjaGym Store order.</p>

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
        <p style="color:#aaa;font-size:12px;text-align:center">NinjaGym Store · Koh Samui, Thailand · <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#aaa">ninjagym.com</a></p>
      </div>
    `,
  });
}
