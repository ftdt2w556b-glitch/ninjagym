import { redirect } from "next/navigation";

// POS has moved to /pos (kiosk route — no Supabase auth required)
// This redirect keeps any bookmarks or nav links working.
export default function PosRedirectPage() {
  redirect("/pos");
}
