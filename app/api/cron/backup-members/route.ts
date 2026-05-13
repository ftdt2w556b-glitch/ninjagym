import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/backup-members
 *
 * Daily Vercel Cron, dumps every `member_registrations` row (parents + top-ups)
 * to JSON, plus a parents-only CSV, and uploads both to the private `backups`
 * Supabase Storage bucket. Old backups beyond `settings.backup_retention_days`
 * (default 30) are deleted on the same pass.
 *
 * Why two formats:
 *  - JSON is the restore-ready source of truth (every column, every row).
 *  - CSV is the human-readable snapshot for eyeballing PINs / kids names.
 *
 * Auth: Vercel Cron sends "Authorization: Bearer ${CRON_SECRET}". If CRON_SECRET
 * is unset, the route requires no auth (set it in production!).
 *
 * Restore plan if anything ever goes wrong:
 *   1. Download the latest JSON from the `backups` bucket
 *   2. Run an `INSERT ... ON CONFLICT (id) DO UPDATE` script against the rows
 *   3. Sequences for member_registrations.id auto-advance, but you can reset
 *      them with `SELECT setval('member_registrations_id_seq', max(id)) FROM member_registrations;`
 */

const BUCKET = "backups";
const PATH_PREFIX = "members/";

const PARENT_CSV_FIELDS = [
  "id","name","pin","phone","email","kids_names","kids_count",
  "membership_type","slip_status","sessions_remaining","loyalty_discount","created_at",
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], fields: readonly string[]): string {
  const lines = [fields.join(",")];
  for (const r of rows) lines.push(fields.map((f) => csvCell(r[f])).join(","));
  return lines.join("\n");
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  // Create-if-missing. Bucket is PRIVATE, only service-role reads.
  const { data: existing } = await admin.storage.getBucket(BUCKET);
  if (!existing) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}

export async function GET(request: NextRequest) {
  // Auth, same convention as /api/cron/cleanup-slips
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  await ensureBucket(admin);

  // Retention from settings (fall back to 30 days)
  const { data: setting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "backup_retention_days")
    .maybeSingle();
  const retentionDays = parseInt(String(setting?.value ?? "30"), 10);

  // Pull every member row.
  const { data: rows, error: fetchError } = await admin
    .from("member_registrations")
    .select("*")
    .order("id", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: `fetch: ${fetchError.message}` }, { status: 500 });
  }

  const now = new Date();
  // Bangkok-local YYYY-MM-DD stamp so the filename matches the operator's day.
  const bkk = new Date(now.getTime() + 7 * 3_600_000);
  const stamp = bkk.toISOString().slice(0, 10);
  const isoNow = now.toISOString();

  const jsonPayload = JSON.stringify({
    exported_at: isoNow,
    source: "supabase project bwyprymiykkquszkjkje table member_registrations",
    count: rows?.length ?? 0,
    rows: rows ?? [],
  });

  const parents = (rows ?? []).filter((r) => r.parent_member_id === null);
  const csvPayload = toCsv(parents as Record<string, unknown>[], PARENT_CSV_FIELDS);

  const jsonPath = `${PATH_PREFIX}${stamp}.json`;
  const csvPath  = `${PATH_PREFIX}${stamp}-parents.csv`;

  const [jsonUp, csvUp] = await Promise.all([
    admin.storage.from(BUCKET).upload(jsonPath, new Blob([jsonPayload], { type: "application/json" }), { upsert: true, contentType: "application/json" }),
    admin.storage.from(BUCKET).upload(csvPath,  new Blob([csvPayload],  { type: "text/csv" }),         { upsert: true, contentType: "text/csv" }),
  ]);

  const errors: string[] = [];
  if (jsonUp.error) errors.push(`json upload: ${jsonUp.error.message}`);
  if (csvUp.error)  errors.push(`csv upload: ${csvUp.error.message}`);

  // Prune: list every file in members/, delete those older than the cutoff.
  let pruned = 0;
  const { data: listing } = await admin.storage.from(BUCKET).list("members", { limit: 1000 });
  if (listing && listing.length > 0) {
    const cutoffMs = now.getTime() - retentionDays * 86_400_000;
    const stale: string[] = [];
    for (const f of listing) {
      // Prefer Storage's created_at (most accurate). Fall back to parsing the date prefix.
      const created = f.created_at ? new Date(f.created_at).getTime()
                    : (/^(\d{4}-\d{2}-\d{2})/.exec(f.name)?.[1] ? new Date(/^(\d{4}-\d{2}-\d{2})/.exec(f.name)![1]).getTime() : NaN);
      if (!isNaN(created) && created < cutoffMs) stale.push(`${PATH_PREFIX}${f.name}`);
    }
    if (stale.length > 0) {
      const { error: rmError } = await admin.storage.from(BUCKET).remove(stale);
      if (rmError) errors.push(`prune: ${rmError.message}`);
      else        pruned = stale.length;
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    rows: rows?.length ?? 0,
    parents: parents.length,
    written: { json: jsonPath, csv: csvPath },
    retention_days: retentionDays,
    pruned,
    errors,
  });
}
