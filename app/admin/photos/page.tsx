import { createAdminClient } from "@/lib/supabase/server";
import PhotoManager from "@/components/admin/PhotoManager";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export default async function PhotosPage() {
  const admin = createAdminClient();

  const { data: photos } = await admin
    .from("marketing_photos")
    .select("*, uploader:uploaded_by(name), approver:approved_by(name)")
    .order("created_at", { ascending: false });

  const { data: members } = await admin
    .from("member_registrations")
    .select("id, name")
    .order("name");

  const { data: bookings } = await admin
    .from("event_bookings")
    .select("id, name, event_date")
    .order("event_date", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Marketing Photos</h1>
      <p className="text-sm text-gray-500 mb-6">Upload, review and approve action shots for marketing use.</p>
      <PhotoManager
        photos={photos ?? []}
        members={members ?? []}
        bookings={bookings ?? []}
        supabaseUrl={SUPABASE_URL}
      />
    </div>
  );
}
