import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  const { name, email, subject, message } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email and message are required." }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // No email configured — still return success so the form works
    console.log("Contact form submission (no Resend key):", { name, email, subject, message });
    return NextResponse.json({ ok: true });
  }

  const resend = new Resend(key);

  const { error } = await resend.emails.send({
    from: "NinjaGym <hello@ninjagym.com>",
    to: ["hello@ninjagym.com"],
    replyTo: email,
    subject: subject ? `NinjaGym Contact: ${subject}` : `NinjaGym Contact from ${name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a56db;padding:20px 24px;border-radius:12px 12px 0 0">
          <h2 style="color:#ffe033;margin:0;font-size:22px">NinjaGym Contact Form</h2>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:80px">From:</td>
                <td style="padding:6px 0;font-weight:bold">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Email:</td>
                <td style="padding:6px 0"><a href="mailto:${email}" style="color:#1a56db">${email}</a></td></tr>
            ${subject ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Subject:</td>
                <td style="padding:6px 0">${subject}</td></tr>` : ""}
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
          <p style="color:#111827;line-height:1.6;white-space:pre-wrap">${message}</p>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px">
          NinjaGym, Rick Tew's Dojo, Big C Bophut, Koh Samui
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Contact email error:", error);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
