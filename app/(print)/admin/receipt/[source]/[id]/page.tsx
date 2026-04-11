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

  // Fetch all prices once for qty calculation
  const { data: priceRows } = await admin.from("settings").select("key, value").like("key", "price_%");
  const priceMap: Record<string, number> = {};
  for (const row of priceRows ?? []) {
    priceMap[(row.key as string).replace("price_", "")] = Number(row.value);
  }
  // Reverse map: "Group Session" → "session_group"
  const labelToKey = Object.fromEntries(Object.entries(MEMBERSHIP_LABELS).map(([k, v]) => [v, k]));

  function withQty(label: string, typeKey: string, amt: number): string {
    const unitPrice = priceMap[typeKey] ?? 0;
    const qty = unitPrice > 0 && amt > 0 ? Math.round(amt / unitPrice) : 1;
    return qty > 1 ? `${label} ×${qty}` : label;
  }

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

    const items = data.items as Array<{ name?: string; label?: string; qty?: number }> | null;
    const rawItemName = items?.[0]?.name || items?.[0]?.label || "";
    if (rawItemName) {
      // POS prefixes items with "CustomerName: Program" — strip the prefix
      const programPart = rawItemName.includes(": ")
        ? rawItemName.split(": ").slice(1).join(": ")
        : rawItemName;

      // If qty is already encoded in the label (e.g. "Group Sessions (bulk) ×10 (10% off)")
      // use it directly — stripping the discount suffix for cleaner receipt display
      if (programPart.includes("×")) {
        program = programPart.replace(/\s*\(\d+%\s*off\)/i, "").trim();
      } else {
        // programPart may be a type key ("group_bulk") or display label ("Group Sessions (bulk)")
        const typeKey = MEMBERSHIP_LABELS[programPart] ? programPart : (labelToKey[programPart] ?? programPart);
        const displayLabel = MEMBERSHIP_LABELS[typeKey] ?? programPart;
        // For bulk packs, also check items[0].qty for session count
        const bulkSessionCount = items?.[0]?.qty && items[0].qty > 1 ? items[0].qty : null;
        if (bulkSessionCount) {
          program = `${displayLabel} ×${bulkSessionCount}`;
        } else {
          program = withQty(displayLabel, typeKey, amount);
        }
      }
    } else {
      const typeKey = data.sale_type as string;
      const displayLabel = (MEMBERSHIP_LABELS[typeKey] ?? typeKey) || "POS Sale";
      program = withQty(displayLabel, typeKey, amount);
    }
  } else if (source === "member") {
    const { data } = await admin
      .from("member_registrations")
      .select("id, name, amount_paid, payment_method, slip_reviewed_at, membership_type, notes, sessions_purchased")
      .eq("id", Number(id))
      .maybeSingle();
    if (!data) notFound();

    receiptNo = `MR-${String(data.id).padStart(5, "0")}`;
    dateStr = bangkokDate((data.slip_reviewed_at ?? data.id) as string);
    memberName = data.name as string;
    amount = Number(data.amount_paid ?? 0);
    paymentMethod = data.payment_method === "cash" ? "Cash" : "PromptPay / Transfer";
    notes = (data.notes as string | null) ?? "";

    const membershipType = data.membership_type as string;
    const baseLabel = MEMBERSHIP_LABELS[membershipType] ?? membershipType ?? "";
    const sessionsPurchased = Number(data.sessions_purchased ?? 0);
    if (sessionsPurchased > 1) {
      program = `${baseLabel} ×${sessionsPurchased}`;
    } else {
      program = withQty(baseLabel, membershipType, amount);
    }
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
          .vat-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #555; }
          .vat-row .vat-label { color: #888; }
          .vat-divider { border: none; border-top: 1px solid #e0e0e0; margin: 8px 0; }
          .total-row { display: flex; justify-content: space-between; padding: 12px 16px; background: #1a56db; border-radius: 8px; margin-top: 8px; }
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
            <div className="company-sub">129/19 Moo.1 Bophut, Koh Samui, Suratthani 84320</div>
            <div className="company-sub">Tax ID 0115566016978</div>
            <div className="company-sub">Tel. 0826265991 · www.NinjaGym.com</div>
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

          {(() => {
            const exVat = Math.round(amount / 1.07 * 100) / 100;
            const vat   = Math.round((amount - exVat) * 100) / 100;
            return (
              <>
                <div className="vat-row">
                  <span className="vat-label">Total Excluding VAT</span>
                  <span>฿{exVat.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="vat-row">
                  <span className="vat-label">VAT 7%</span>
                  <span>฿{vat.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <hr className="vat-divider" />
                <div className="total-row">
                  <span className="total-label">Grand Total</span>
                  <span className="total-amount">฿{amount.toLocaleString()}</span>
                </div>
              </>
            );
          })()}

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
