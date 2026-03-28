import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="public-bg min-h-dvh flex flex-col items-center justify-center px-4 text-white text-center">
      <div className="mb-4">
        <Image src="/images/App1_small.png" alt="Ninja" width={160} height={160} className="drop-shadow-2xl opacity-80" />
      </div>
      <h1 className="font-fredoka text-5xl text-white drop-shadow mb-1">404</h1>
      <p className="font-bangers text-xl text-[#ffe033] tracking-widest mb-4">PAGE NOT FOUND</p>
      <p className="text-white/70 text-sm mb-8">This ninja vanished into the shadows.</p>
      <Link
        href="/"
        className="bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-lg rounded-2xl px-8 py-4 shadow-lg hover:brightness-110 transition-all"
      >
        Back to Home 🥷
      </Link>
    </div>
  );
}
