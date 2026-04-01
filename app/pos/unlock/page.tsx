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
    // No password set anywhere — allow through
    const cookieStore = await cookies();
    cookieStore.set("pos_auth", "unlocked", {
      httpOnly: true, sameSite: "strict", path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/pos");
  }

  if (password !== expected) {
    redirect("/pos/unlock?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set("pos_auth", expected, {
    httpOnly: true, sameSite: "strict", path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/pos");
}

export default async function PosUnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "1";

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <h1 className="font-fredoka text-4xl text-white mb-2">NinjaGym POS</h1>
      <p className="text-gray-400 mb-8">Enter the kiosk password to unlock</p>

      {hasError && (
        <p className="text-red-400 text-sm mb-4">Incorrect password. Try again.</p>
      )}

      <form action={unlockKiosk} className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="Kiosk password"
          className="w-full bg-gray-800 text-white border border-gray-600 rounded-2xl px-4 py-4 text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1a56db] placeholder:text-gray-500 placeholder:tracking-normal"
        />
        <button
          type="submit"
          className="bg-[#1a56db] text-white font-bold text-lg py-4 rounded-2xl hover:bg-blue-600 transition-colors"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
