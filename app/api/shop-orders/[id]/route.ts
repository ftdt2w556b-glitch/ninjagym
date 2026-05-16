import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWritePin } from "@/lib/staff-pin-server";
import { logStaffAction } from "@/lib/staff-actions";

/**
 * DELETE /api/shop-orders/[id]
 *
 * Permanently removes a shop order and its linked cash_sales row (if any).
 * Admin and owner only, matching the same gate used elsewhere for destructive
 * actions (PaymentActions uses canDelete = admin/owner).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId || isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Forbidden, only admin or owner can delete orders" },
      { status: 403 },
    );
  }

  const auth = await requireWritePin(request);
  if ("response" in auth) return auth.response;

  // Any linked cash_sales row first.
  await admin
    .from("cash_sales")
    .delete()
    .eq("sale_type", "shop")
    .eq("reference_id", orderId);

  const { error } = await admin
    .from("shop_orders")
    .delete()
    .eq("id", orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logStaffAction({
    actor:         auth.actor,
    actionType:    "delete",
    targetTable:   "shop_orders",
    targetId:      orderId,
    ip:            auth.ip,
    sessionUserId: auth.sessionUserId,
  });

  return NextResponse.json({ ok: true, actor_name: auth.actor.name });
}
