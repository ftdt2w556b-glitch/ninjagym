import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup-slips
 *
 * Daily Vercel Cron — deletes slip images older than `slip_retention_days`
 * (default 180 days = 6 months) from Supabase Storage and nulls out the
 * `slip_image` column on the corresponding row. The financial record (amount,
 * payment_method, slip_hash, slip_uploaded_at, slip_reviewed_at, notes) is
 * preserved indefinitely.
 *
 * Auth: Vercel Cron sends "Authorization: Bearer ${CRON_SECRET}". If
 * CRON_SECRET is unset, the route requires no auth (set it in production).
 */
const TABLES = ["member_registrations", "event_bookings", "shop_orders"] as const;
const BATCH  = 500;

export async function GET(request: NextRequest) {
  // Auth
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  // Resolve retention window from settings (fall back to 180 days).
  const { data: setting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "slip_retention_days")
    .maybeSingle();
  const retentionDays = parseInt(String(setting?.value ?? "180"), 10);
  const cutoffIso     = new Date(Date.now() - retentionDays * 86_400_000).toISOString();

  const report: Record<string, { rows: number; storage_objects: number; errors: string[] }> = {};

  for (const table of TABLES) {
    const tableReport = { rows: 0, storage_objects: 0, errors: [] as string[] };

    // Pull a bounded batch of old rows still pointing at images.
    const { data: rows, error } = await admin
      .from(table)
      .select("id, slip_image")
      .not("slip_image", "is", null)
      .lt("slip_uploaded_at", cutoffIso)
      .limit(BATCH);

    if (error) {
      tableReport.errors.push(`fetch: ${error.message}`);
      report[table] = tableReport;
      continue;
    }
    if (!rows || rows.length === 0) {
      report[table] = tableReport;
      continue;
    }

    const fileNames = rows
      .map((r) => r.slip_image as string | null)
      .filter((s): s is string => !!s);

    if (fileNames.length > 0) {
      const { error: rmError } = await admin.storage.from("slips").remove(fileNames);
      if (rmError) tableReport.errors.push(`storage.remove: ${rmError.message}`);
      else        tableReport.storage_objects = fileNames.length;
    }

    // Null the column regardless of storage outcome — if a file was already
    // gone the next run shouldn't keep finding it. Keep the hash + metadata.
    const ids = rows.map((r) => r.id);
    const { error: updError } = await admin
      .from(table)
      .update({ slip_image: null })
      .in("id", ids);
    if (updError) tableReport.errors.push(`update: ${updError.message}`);
    else          tableReport.rows = ids.length;

    report[table] = tableReport;
  }

  return NextResponse.json({ ok: true, retention_days: retentionDays, cutoff: cutoffIso, report });
}
