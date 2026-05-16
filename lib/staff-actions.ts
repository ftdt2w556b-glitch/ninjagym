/**
 * staff_actions audit log.
 *
 * Attribution comes from the PIN typed at action time (actor_kind/id/name)
 * NOT from the shared Supabase session. user_id is recorded as a secondary
 * forensic field — usually the centre's shared "NinjaGym" login.
 *
 * Writes are best-effort: a logging failure must never block the action.
 */

import { createAdminClient } from "@/lib/supabase/server";
import type { StaffActor } from "@/lib/staff-pin";

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
  actor:        StaffActor;          // resolved from PIN
  actionType:   ActionType;
  targetTable?: string;
  targetId?:    string | number;
  ip?:          string | null;
  sessionUserId?: string | null;     // shared NinjaGym session, optional
}

export async function logStaffAction(input: LogActionInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("staff_actions").insert({
      actor_kind:   input.actor.kind,
      actor_id:     input.actor.id,
      actor_name:   input.actor.name,
      user_id:      input.sessionUserId ?? null,
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
 * render "Approved by Naing · May 14, 3:42pm" beside each row.
 */
export async function getLatestActionFor(
  targetTable: string,
  targetId: string | number,
): Promise<{ actorName: string | null; actionType: string; createdAt: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("staff_actions")
    .select("actor_name, action_type, created_at")
    .eq("target_table", targetTable)
    .eq("target_id", String(targetId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    actorName:  data.actor_name,
    actionType: data.action_type,
    createdAt:  data.created_at,
  };
}
