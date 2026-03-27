import { createAdminClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function EditEventBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: b } = await admin
    .from("event_bookings")
    .select("*")
    .eq("id", id)
    .single();

  if (!b) notFound();

  async function updateBooking(formData: FormData) {
    "use server";
    const adminClient = createAdminClient();
    await adminClient.from("event_bookings").update({
      name: formData.get("name"),
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      event_date: formData.get("event_date"),
      time_slot: formData.get("time_slot"),
      hours: formData.get("hours") || null,
      num_hours: Number(formData.get("num_hours")),
      num_kids: Number(formData.get("num_kids")),
      birthday_child_name: formData.get("birthday_child_name") || null,
      birthday_child_age: Number(formData.get("birthday_child_age")) || null,
      notes: formData.get("notes") || null,
      slip_status: formData.get("slip_status"),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    redirect("/admin/event-bookings");
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Event Booking #{b.id}</h1>
      <form action={updateBooking} className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
        {[
          { name: "name", label: "Name", type: "text", value: b.name, required: true },
          { name: "phone", label: "Phone", type: "tel", value: b.phone ?? "" },
          { name: "email", label: "Email", type: "email", value: b.email ?? "" },
          { name: "event_date", label: "Event Date", type: "date", value: b.event_date, required: true },
          { name: "hours", label: "Time display (e.g. 2pm-4pm)", type: "text", value: b.hours ?? "" },
          { name: "num_hours", label: "Number of Hours", type: "number", value: b.num_hours ?? 2 },
          { name: "num_kids", label: "Number of Kids", type: "number", value: b.num_kids ?? 1 },
          { name: "birthday_child_name", label: "Birthday Child Name", type: "text", value: b.birthday_child_name ?? "" },
          { name: "birthday_child_age", label: "Birthday Child Age", type: "number", value: b.birthday_child_age ?? "" },
          { name: "notes", label: "Notes", type: "text", value: b.notes ?? "" },
        ].map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              defaultValue={String(field.value)}
              required={field.required}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
        ))}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Time Slot</label>
          <select name="time_slot" defaultValue={b.time_slot}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
            {["morning", "afternoon", "evening", "weekend"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
          <select name="slip_status" defaultValue={b.slip_status}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
            {["pending_review", "cash_pending", "approved", "rejected"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit"
            className="bg-[#1a56db] text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
          <a href="/admin/event-bookings"
            className="text-gray-500 px-6 py-2.5 rounded-xl hover:bg-gray-100 transition-colors font-medium">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
