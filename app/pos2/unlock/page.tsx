import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";

async function getPosPassword(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
    if (data?.value) return data.value;
  } catch {}
  return process.env.POS_PASSWORD ?? null;
}

async function unlockKiosk(formData: FormData) {
  "use server";
  const password = formData.get("password") as string;
  const expected = await getPosPassword();

  if (!expected) {
    const cookieStore = await cookies();
    cookieStore.set("pos_auth", "unlocked", {
      httpOnly: true, sameSite: "strict", path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/pos2");
  }

  if (password !== expected) {
    redirect("/pos2/unlock?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set("pos_auth", expected, {
    httpOnly: true, sameSite: "strict", path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/pos2");
}

export default async function Pos2UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "1";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#111827", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <h1 style={{ color: "#ffffff", fontSize: "32px", fontWeight: "bold", marginBottom: "8px", textAlign: "center" }}>NinjaGym POS</h1>
      <p style={{ color: "#9ca3af", marginBottom: "32px", textAlign: "center" }}>Enter the kiosk password to unlock</p>

      {hasError && (
        <p style={{ color: "#f87171", marginBottom: "16px" }}>Incorrect password. Try again.</p>
      )}

      <form action={unlockKiosk} style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column" }}>
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="Kiosk password"
          style={{ width: "100%", backgroundColor: "#1f2937", color: "#ffffff", border: "1px solid #4b5563", borderRadius: "12px", padding: "16px", fontSize: "20px", textAlign: "center", marginBottom: "16px", boxSizing: "border-box" }}
        />
        <button
          type="submit"
          style={{ backgroundColor: "#1a56db", color: "#ffffff", fontWeight: "bold", fontSize: "18px", padding: "16px", borderRadius: "12px", border: "none", cursor: "pointer" }}
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
