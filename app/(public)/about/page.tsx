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
      <p className="font-bangers text-lg text-[#ffe033] tracking-widest mb-6">& NINJAGYM SAMUI</p>

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
          { stat: "30+", label: "Years Teaching" },
          { stat: "GLOBAL", label: "International" },
          { stat: "1,000s", label: "Kids Trained" },
        ].map((s) => (
          <div key={s.stat} className="bg-white/15 rounded-2xl p-3 text-center">
            <p className="font-fredoka text-2xl text-[#ffe033]">{s.stat}</p>
            <p className="text-xs text-white/80 font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 mb-6">

        {/* Location & Hours */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-3">📍 Find Us</h2>
          <p className="text-sm text-gray-700 font-semibold">Big C Bophut, ground floor</p>
          <p className="text-sm text-gray-500 mb-3">Next to main entrance, near Ring Road / Starbucks, Koh Samui</p>
          <div className="flex flex-col gap-1.5 text-sm text-gray-600">
            <p>🕘 Opens <strong>9:30am</strong> daily (8am with advance notice)</p>
            <p>👶 Kid drop-in sessions available <strong>all day, every day</strong></p>
            <p>🏕️ Day Camps: 5-hour sessions, drop-in before 3pm</p>
            <p>💪 Adult sessions: <strong>8am</strong> or <strong>8pm</strong></p>
          </div>
        </div>

        {/* About Rick */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-2">Rick Tew</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            With over 30 years teaching martial arts worldwide, Rick Tew created a training system based on ninjitsu martial science — covering ninja training, obstacle courses, climbing, jumping, rolling, falling, and martial arts. He is also the creator of <strong>WINJITSU</strong>, a mental martial art program focused on mind, body, and spirit development.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Rick&apos;s approach merges traditional martial arts discipline with modern coaching — focused on building confidence, coordination, and physical ability at every level.
          </p>
        </div>

        {/* The NinjaGym Method */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-2">The NinjaGym Method</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            NinjaGym is an adventure zone, not a traditional dojo. Guides actively <em>participate</em> rather than just supervise. Following the ninja symbol of patience and endurance, every session builds habitual training and daily focus.
          </p>
          <ul className="flex flex-col gap-1.5 text-sm text-gray-600">
            {[
              "Improved daily wellness and better sleep",
              "Enhanced mood and outlook",
              "Strength, flexibility and cardiovascular fitness",
              "Community-based safe environment",
              "Suitable for all levels — kids aged 3 and up",
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-[#1a56db]">🥷</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Programs */}
        <div className="bg-[#1a56db] rounded-2xl p-5 shadow text-white">
          <h2 className="font-bold text-lg mb-4">Programs</h2>

          <div className="flex flex-col gap-4">
            <div>
              <p className="font-bold text-[#ffe033] text-sm mb-1">👧 Kids Training</p>
              <ul className="text-sm text-white/90 flex flex-col gap-1">
                <li>• Martial arts, climbing, parkour &amp; ninja obstacles</li>
                <li>• Jump, roll and movement fundamentals</li>
                <li>• Drop-in all day, every day</li>
                <li>• 1-on-1 guides available for younger children</li>
                <li>• 2-hour sessions with game room combo option</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#ffe033] text-sm mb-1">💪 Adult Programs</p>
              <ul className="text-sm text-white/90 flex flex-col gap-1">
                <li>• Morning (8am) and evening (8pm) sessions</li>
                <li>• Martial arts fitness with climbing and kicking</li>
                <li>• Full obstacle course training</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#ffe033] text-sm mb-1">🏕️ Ninja Day Camps</p>
              <ul className="text-sm text-white/90 flex flex-col gap-1">
                <li>• 5-hour sessions</li>
                <li>• Drop-in before 3pm</li>
                <li>• Extended activity packages available</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Event Space */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-3">🎉 Event Space Rental</h2>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: "Weekends", price: "5,000 THB/hr" },
              { label: "Weekdays 3:30pm–6:30pm", price: "5,000 THB/hr" },
              { label: "Weekdays 9am–3pm & 6:30pm–9:30pm", price: "3,000 THB/hr" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-600">{r.label}</span>
                <span className="font-bold text-[#1a56db]">{r.price}</span>
              </div>
            ))}
          </div>
          <Link href="/birthdays" className="block mt-4 text-center text-sm text-[#1a56db] font-semibold underline">
            Book an Event →
          </Link>
        </div>

        {/* Registration note */}
        <div className="bg-[#ffe033] rounded-2xl p-4 shadow">
          <p className="text-sm font-bold text-[#1a56db] mb-1">📋 Registration</p>
          <p className="text-sm text-[#1a56db]">
            Advance registration recommended. Bring your email receipt or show your QR card — membership is prepared upon arrival.
          </p>
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
