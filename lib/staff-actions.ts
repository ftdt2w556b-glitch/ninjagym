/**
 * staff_actions audit log.
 *
 * Every write that goes through the dashboard PIN gate calls logStaffAction
 * so the admin UI can render "Approved by Naing · May 14, 3:42pm" beside
 * the row. Owner / admin writes still get logged even though they bypass
 * the PIN re-prompt — the logged-in user_id is the source of truth.
 *
 * Writes are best-effort: a logging failure must never block the action.
 */

import { createAdminClient } from "@/lib/supabase/server";

export type ActionType =
  | "approve"
  | "reject"
  | "restore"
  | "edit"
  | "delete"
  | "settle_drawer"
  | "set_float"
  | "pos_sale"
  | "other";

export interface LogActionInput {
  userId:       string;
  actionType:   ActionType;
  targetTable?: string;
  targetId?:    string | number;
  ip?:          string | null;
}

export async function logStaffAction(input: LogActionInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("staff_actions").insert({
      user_id:      input.userId,
      action_type:  input.actionType,
      target_table: input.targetTable ?? null,
      target_id:    input.targetId != null ? String(input.targetId) : null,
      ip:           input.ip ?? null,
    });
  } catch (err) {
    // Audit log must never break a real action.
    console.error("[staff-actions] insert failed:", err);
  }
}

/**
 * Fetch the latest action for a given target. Used by the admin UI to
 * render "Approved by X" beside bookings/orders.
 */
export async function getLatestActionFor(
  targetTable: string,
  targetId: string | number,
): Promise<{ userId: string | null; actionType: string; createdAt: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("staff_actions")
    .select("user_id, action_type, created_at")
    .eq("target_table", targetTable)
    .eq("target_id", String(targetId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { userId: data.user_id, actionType: data.action_type, createdAt: data.created_at };
}
