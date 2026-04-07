import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

const MEMBERSHIP_LABELS: Record<string, string> = {
  session_group:    "Group Session",
  session_1to1:     "1-to-1 Private Guide",
  day_camp:         "Day Camp (10am–2pm)",
  combo_game_train: "Combo Game & Train (2 hrs)",
  all_day:          "All Day (max 8 hrs)",
  climb_unguided:   "Unguided Climb Zone (20 min)",
  monthly_flex:     "Monthly Flex: any day or time",
  birthday_event:   "Birthday / Event Guest",
  group_bulk:       "Group Sessions (bulk)",
  daycamp_bulk:     "Day Camp Sessions (bulk)",
  "1to1_bulk":      "1-to-1 Sessions (bulk)",
  allday_bulk:      "All Day Passes (bulk)",
  combo_bulk:       "Combo Sessions (bulk)",
};

function bangkokDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ source: string; id: string }>;
}) {
  const { source, id } = await params;
  const admin = createAdminClient();

  let receiptNo = "";
  let dateStr = "";
  let memberName = "";
  let program = "";
  let paymentMethod = "";
  let amount = 0;
  let notes = "";

  if (source === "cash_sale") {
    const { data } = await admin
      .from("cash_sales")
      .select("id, amount, processed_at, sale_type, notes, staff_name, items")
      .eq("id", Number(id))
      .maybeSingle();
    if (!data) notFound();

    receiptNo = `CS-${String(data.id).padStart(5, "0")}`;
    dateStr = bangkokDate(data.processed_at as string);
    amount = Number(data.amount);
    paymentMethod = "Cash";

    const rawNotes = (data.notes as string | null) ?? "";
    const walkInMatch = rawNotes.match(/Quick walk-in:\s*(.+)/i);
    memberName = walkInMatch ? walkInMatch[1] : (rawNotes || "Walk-in Customer");
    notes = "";

    const items = data.items as Array<{ label: string }> | null;
    if (items && items.length > 0) {
      program = MEMBERSHIP_LABELS[items[0].label] ?? items[0].label;
    } else {
      program = (MEMBERSHIP_LABELS[data.sale_type as string] ?? (data.sale_type as string)) || "POS Sale";
    }
  } else if (source === "member") {
    const { data } = await admin
      .from("member_registrations")
      .select("id, name, amount_paid, payment_method, slip_reviewed_at, membership_type, notes")
      .eq("id", Number(id))
      .maybeSingle();
    if (!data) notFound();

    receiptNo = `MR-${String(data.id).padStart(5, "0")}`;
    dateStr = bangkokDate((data.slip_reviewed_at ?? data.id) as string);
    memberName = data.name as string;
    amount = Number(data.amount_paid ?? 0);
    paymentMethod = data.payment_method === "cash" ? "Cash" : "PromptPay / Transfer";
    program = MEMBERSHIP_LABELS[data.membership_type as string] ?? (data.membership_type as string) ?? "";
    notes = (data.notes as string | null) ?? "";
  } else {
    notFound();
  }

  return (
    <html>
      <head>
        <title>Receipt {receiptNo}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; }
          .page { background: white; max-width: 480px; margin: 40px auto; padding: 40px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #1a56db; padding-bottom: 24px; margin-bottom: 24px; }
          .logo { display: block; width: 80px; height: 80px; object-fit: contain; margin: 0 auto 12px; }
          .company { font-size: 18px; font-weight: 700; color: #1a1a2e; }
          .company-sub { font-size: 12px; color: #666; margin-top: 2px; }
          .receipt-title { font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #1a56db; text-transform: uppercase; margin-top: 16px; }
          .receipt-no { font-size: 12px; color: #888; margin-top: 4px; }
          .section { margin-bottom: 20px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
          .row:last-child { border-bottom: none; }
          .label { color: #888; }
          .value { font-weight: 500; color: #1a1a1a; text-align: right; max-width: 60%; }
          .total-row { display: flex; justify-content: space-between; padding: 12px 16px; background: #1a56db; border-radius: 8px; margin-top: 16px; }
          .total-label { color: white; font-weight: 700; font-size: 15px; }
          .total-amount { color: white; font-weight: 700; font-size: 18px; }
          .paid-badge { text-align: center; margin-top: 20px; }
          .paid-badge span { display: inline-block; border: 3px solid #16a34a; color: #16a34a; font-weight: 800; font-size: 22px; letter-spacing: 6px; padding: 6px 20px; border-radius: 6px; transform: rotate(-5deg); }
          .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
          .print-btn { display: block; text-align: center; margin: 20px auto 0; padding: 10px 32px; background: #1a56db; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
          @media print {
            body { background: white; }
            .page { box-shadow: none; margin: 0; padding: 24px; max-width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          <div className="header">
            <img
              src="/images/rick-tew-logo.png"
              alt="Rick Tew Co., Ltd."
              className="logo"
            />
            <div className="company">Rick Tew Co., Ltd.</div>
            <div className="company-sub">Bangkok, Thailand · ninjagym.com</div>
            <div className="receipt-title">Official Receipt</div>
            <div className="receipt-no">{receiptNo}</div>
          </div>

          <div className="section">
            <div className="row">
              <span className="label">Date</span>
              <span className="value">{dateStr}</span>
            </div>
            <div className="row">
              <span className="label">Customer</span>
              <span className="value">{memberName}</span>
            </div>
            {program && (
              <div className="row">
                <span className="label">Program</span>
                <span className="value">{program}</span>
              </div>
            )}
            <div className="row">
              <span className="label">Payment</span>
              <span className="value">{paymentMethod}</span>
            </div>
            {notes && !notes.startsWith("Quick walk-in:") && (
              <div className="row">
                <span className="label">Notes</span>
                <span className="value">{notes}</span>
              </div>
            )}
          </div>

          <div className="total-row">
            <span className="total-label">Total Paid</span>
            <span className="total-amount">฿{amount.toLocaleString()}</span>
          </div>

          <div className="paid-badge">
            <span>PAID</span>
          </div>

          <div className="footer">
            This receipt is issued by Rick Tew Co., Ltd.<br />
            Thank you for visiting Rick Tew&apos;s NinjaGym!
          </div>

          <PrintButton />
        </div>
      </body>
    </html>
  );
}
