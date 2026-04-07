import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PrintAllButton from "./PrintAllButton";
import { bangkokStartOfDay, bangkokEndOfDay } from "@/lib/timezone";

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
    year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function periodLabel(mode: string, date: string) {
  const d = new Date(date + "T00:00:00");
  if (mode === "day") return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  if (mode === "month") return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  return d.getFullYear().toString();
}

export default async function PrintAllReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string }>;
}) {
  const { mode = "day", date = new Date().toISOString().slice(0, 10) } = await searchParams;

  const admin = createAdminClient();

  let from: string;
  let to: string;

  if (mode === "day") {
    from = bangkokStartOfDay(date);
    to = bangkokEndOfDay(date);
  } else if (mode === "month") {
    const [y, m] = date.split("-");
    from = bangkokStartOfDay(`${y}-${m}-01`);
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    to = bangkokEndOfDay(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
  } else {
    const y = date.slice(0, 4);
    from = bangkokStartOfDay(`${y}-01-01`);
    to = bangkokEndOfDay(`${y}-12-31`);
  }

  const [{ data: cashSales }, { data: memberPayments }, { data: priceSettings }] = await Promise.all([
    admin.from("cash_sales").select("id, amount, processed_at, sale_type, notes, staff_name, items")
      .gte("processed_at", from).lte("processed_at", to).order("processed_at"),
    admin.from("member_registrations").select("id, name, amount_paid, payment_method, slip_reviewed_at, membership_type, notes")
      .eq("slip_status", "approved").neq("payment_method", "cash")
      .gte("slip_reviewed_at", from).lte("slip_reviewed_at", to).order("slip_reviewed_at"),
    admin.from("settings").select("key, value").like("key", "price_%"),
  ]);

  const priceMap: Record<string, number> = {};
  for (const row of priceSettings ?? []) {
    priceMap[(row.key as string).replace("price_", "")] = Number(row.value);
  }
  const labelToKey = Object.fromEntries(Object.entries(MEMBERSHIP_LABELS).map(([k, v]) => [v, k]));
  function withQty(label: string, typeKey: string, amt: number): string {
    const unitPrice = priceMap[typeKey] ?? 0;
    const qty = unitPrice > 0 && amt > 0 ? Math.round(amt / unitPrice) : 1;
    return qty > 1 ? `${label} ×${qty}` : label;
  }

  type Receipt = {
    no: string; date: string; customer: string;
    program: string; method: string; amount: number; notes: string;
  };

  const receipts: Receipt[] = [
    ...(cashSales ?? []).map((s) => {
      const rawNotes = (s.notes as string | null) ?? "";
      const walkInMatch = rawNotes.match(/Quick walk-in:\s*(.+)/i);
      const customer = walkInMatch ? walkInMatch[1] : (rawNotes || "Walk-in Customer");
      const items = s.items as Array<{ name?: string; label?: string }> | null;
      const rawItemName = items?.[0]?.name || items?.[0]?.label || "";
      let program: string;
      if (rawItemName) {
        const programPart = rawItemName.includes(": ")
          ? rawItemName.split(": ").slice(1).join(": ")
          : rawItemName;
        const typeKey = MEMBERSHIP_LABELS[programPart] ? programPart : (labelToKey[programPart] ?? programPart);
        const displayLabel = MEMBERSHIP_LABELS[typeKey] ?? programPart;
        program = withQty(displayLabel, typeKey, Number(s.amount));
      } else {
        const typeKey = s.sale_type as string;
        const displayLabel = (MEMBERSHIP_LABELS[typeKey] ?? typeKey) || "POS Sale";
        program = withQty(displayLabel, typeKey, Number(s.amount));
      }
      return {
        no: `CS-${String(s.id).padStart(5, "0")}`,
        date: bangkokDate(s.processed_at as string),
        customer,
        program,
        method: "Cash",
        amount: Number(s.amount),
        notes: "",
      };
    }),
    ...(memberPayments ?? []).map((m) => {
      const membershipType = m.membership_type as string;
      const baseLabel = MEMBERSHIP_LABELS[membershipType] ?? membershipType ?? "";
      const amt = Number(m.amount_paid ?? 0);
      const unitPrice = priceMap[membershipType] ?? 0;
      const qty = unitPrice > 0 && amt > 0 ? Math.round(amt / unitPrice) : 1;
      return {
        no: `MR-${String(m.id).padStart(5, "0")}`,
        date: bangkokDate(m.slip_reviewed_at as string),
        customer: m.name as string,
        program: qty > 1 ? `${baseLabel} ×${qty}` : baseLabel,
        method: "PromptPay / Transfer",
        amount: amt,
        notes: (m.notes as string | null) ?? "",
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (receipts.length === 0) notFound();

  const total = receipts.reduce((s, r) => s + r.amount, 0);
  const label = periodLabel(mode, date);

  return (
    <html>
      <head>
        <title>All Receipts — {label}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; }
          .controls { background: white; padding: 16px 32px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 16px; }
          .controls span { font-size: 14px; color: #555; }
          .print-btn { padding: 8px 24px; background: #1a56db; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
          .receipt { background: white; max-width: 480px; margin: 32px auto; padding: 36px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); page-break-after: always; }
          .receipt:last-of-type { page-break-after: auto; }
          .header { text-align: center; border-bottom: 2px solid #1a56db; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { display: block; width: 70px; height: 70px; object-fit: contain; margin: 0 auto 10px; }
          .company { font-size: 17px; font-weight: 700; color: #1a1a2e; }
          .company-sub { font-size: 11px; color: #888; margin-top: 2px; }
          .receipt-title { font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #1a56db; text-transform: uppercase; margin-top: 14px; }
          .receipt-no { font-size: 11px; color: #aaa; margin-top: 3px; }
          .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
          .row:last-child { border-bottom: none; }
          .label { color: #999; }
          .value { font-weight: 500; color: #1a1a1a; text-align: right; max-width: 60%; }
          .total-row { display: flex; justify-content: space-between; padding: 10px 14px; background: #1a56db; border-radius: 7px; margin-top: 14px; }
          .total-label { color: white; font-weight: 700; font-size: 14px; }
          .total-amount { color: white; font-weight: 700; font-size: 16px; }
          .paid-badge { text-align: center; margin-top: 16px; }
          .paid-badge span { display: inline-block; border: 2px solid #16a34a; color: #16a34a; font-weight: 800; font-size: 18px; letter-spacing: 5px; padding: 4px 16px; border-radius: 5px; transform: rotate(-5deg); }
          .footer { text-align: center; margin-top: 18px; padding-top: 12px; border-top: 1px solid #eee; font-size: 10px; color: #ccc; }
          @media print {
            body { background: white; }
            .controls { display: none !important; }
            .receipt { box-shadow: none; margin: 0; padding: 24px; max-width: 100%; }
          }
        `}</style>
      </head>
      <body>
        <div className="controls">
          <span>{receipts.length} receipts · {label} · Total ฿{total.toLocaleString()}</span>
          <PrintAllButton />
        </div>

        {receipts.map((r) => (
          <div key={r.no} className="receipt">
            <div className="header">
              <img src="/images/rick-tew-logo.png" alt="Rick Tew Co., Ltd." className="logo" />
              <div className="company">Rick Tew Co., Ltd.</div>
              <div className="company-sub">Bangkok, Thailand · ninjagym.com</div>
              <div className="receipt-title">Official Receipt</div>
              <div className="receipt-no">{r.no}</div>
            </div>

            <div>
              <div className="row"><span className="label">Date</span><span className="value">{r.date}</span></div>
              <div className="row"><span className="label">Customer</span><span className="value">{r.customer}</span></div>
              {r.program && <div className="row"><span className="label">Program</span><span className="value">{r.program}</span></div>}
              <div className="row"><span className="label">Payment</span><span className="value">{r.method}</span></div>
              {r.notes && <div className="row"><span className="label">Notes</span><span className="value">{r.notes}</span></div>}
            </div>

            <div className="total-row">
              <span className="total-label">Total Paid</span>
              <span className="total-amount">฿{r.amount.toLocaleString()}</span>
            </div>

            <div className="paid-badge"><span>PAID</span></div>

            <div className="footer">
              This receipt is issued by Rick Tew Co., Ltd.<br />
              Thank you for visiting Rick Tew&apos;s NinjaGym!
            </div>
          </div>
        ))}
      </body>
    </html>
  );
}
