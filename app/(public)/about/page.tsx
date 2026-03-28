import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="px-4 py-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-white/70 text-sm hover:text-white">← Back</Link>
        <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
      </div>

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">About Rick Tew</h1>
      <p className="font-bangers text-lg text-[#ffe033] tracking-widest mb-6">& NINJAGYM</p>

      {/* Rick Tew photo */}
      <div className="rounded-2xl overflow-hidden shadow-xl mb-6">
        <Image
          src="/images/App3_small.png"
          alt="Rick Tew"
          width={480}
          height={320}
          className="w-full object-cover"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { stat: "20+", label: "Years Teaching" },
          { stat: "GLOBAL", label: "International" },
          { stat: "1,000s", label: "Kids Trained" },
        ].map((s) => (
          <div key={s.stat} className="bg-white/15 rounded-2xl p-3 text-center">
            <p className="font-fredoka text-2xl text-[#ffe033]">{s.stat}</p>
            <p className="text-xs text-white/80 font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Content cards */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-2">Rick Tew</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            A martial arts instructor with over two decades of experience inspiring children and adults worldwide. Rick&apos;s approach merges traditional martial arts discipline with modern coaching methods — focused on building confidence, coordination, and physical ability in every student.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-2">The NinjaGym Method</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            NinjaGym is an adventure zone, not a traditional dojo. The program emphasises movement skills — climbing, rolling, jumping — combined with martial arts fundamentals like focus and discipline. Sessions are designed to challenge kids at their own level in a fun, safe environment.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-2">📍 Location</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Based in Koh Samui, Thailand. We offer drop-in sessions, packages, and monthly memberships for both tourists and residents. Come as you are — no experience needed!
          </p>
          <p className="text-sm text-gray-500 mt-2">Big C, Bophut, Koh Samui</p>
        </div>

        {/* What's included */}
        <div className="bg-[#1a56db] rounded-2xl p-5 shadow text-white">
          <h2 className="font-bold text-lg mb-3">What&apos;s Included</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {[
              "Guided training session with certified instructor",
              "Access to climbing, jumping and ninja zones",
              "Safe padded equipment throughout",
              "Suitable for all levels — beginner to advanced",
              "Fun for kids aged 3 and up",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span>🥷</span>
                <span className="text-white/90">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/join"
        className="block bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-xl rounded-2xl py-4 text-center shadow-lg hover:brightness-110 transition-all"
      >
        🥷 Join NinjaGym
      </Link>
    </div>
  );
}
