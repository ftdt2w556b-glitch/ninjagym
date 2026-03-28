import Link from "next/link";
import Image from "next/image";
import PublicPageHeader from "@/components/public/PublicPageHeader";

export default function AboutPage() {
  return (
    <div className="px-4 py-6 text-white">
      <PublicPageHeader />

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">About NinjaGym</h1>
      <p className="text-[#ffe033] font-bold tracking-wide mb-6">RICK TEW&apos;S DOJO, KOH SAMUI</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { stat: "30+", label: "Years Teaching" },
          { stat: "5", label: "Winjitsu Books" },
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
          <h2 className="font-bold text-[#1a56db] text-lg mb-3">Find Us</h2>
          <p className="text-sm text-gray-700 font-semibold">Big C Bophut, ground floor</p>
          <p className="text-sm text-gray-500 mb-3">Next to main entrance, near Ring Road and Starbucks, Koh Samui</p>
          <a
            href="https://maps.app.goo.gl/eAfNRktaPpr9uhYi9"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-50 text-[#1a56db] font-semibold text-sm px-4 py-2 rounded-xl mb-4 hover:bg-blue-100 transition-colors"
          >
            <span>📍</span> Open in Google Maps
          </a>
          <div className="flex flex-col gap-1.5 text-sm text-gray-600">
            <p>Opens <strong>9:30am</strong> daily (8am with advance notice)</p>
            <p>Kid drop-in sessions available <strong>all day, every day</strong></p>
            <p>Day Camps: 10am to 2pm, drop-in before 2pm</p>
            <p>Adult sessions: <strong>8am</strong> or <strong>8pm</strong> by advance booking only</p>
          </div>
        </div>

        {/* About Rick */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-2">Rick Tew</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Rick Tew is an internationally recognized peak performance strategist, martial arts expert and author. With over 30 years teaching worldwide, he developed a training system based on ninjitsu martial science, covering ninja training, obstacle courses, climbing, jumping, rolling, falling and martial arts.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            He is the creator of <strong>WINJITSU</strong>, a mental martial art system focused on mind, body and spirit development. He has published 5 books in the Winjitsu series, spoken at Fortune 500 companies and run ninja training camps across the globe.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Rick&apos;s approach merges traditional martial arts discipline with modern coaching, focused on building confidence, coordination and physical ability at every level.
          </p>
          <a
            href="https://www.ricktew.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-[#1a56db] font-semibold underline"
          >
            Learn more at ricktew.com
          </a>
        </div>

        {/* The NinjaGym Method */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-2">The NinjaGym Method</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            NinjaGym is an adventure zone, not a traditional dojo. Guides actively participate rather than just supervise. Following the ninja symbol of patience and endurance, every session builds habitual training and daily focus.
          </p>
          <ul className="flex flex-col gap-1.5 text-sm text-gray-600">
            {[
              "Improved daily wellness and better sleep",
              "Enhanced mood and outlook",
              "Strength, flexibility and cardiovascular fitness",
              "Community-based safe environment",
              "Suitable for all levels, kids aged 3 and up",
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
              <p className="font-bold text-[#ffe033] text-sm mb-1">Kids Training</p>
              <ul className="text-sm text-white/90 flex flex-col gap-1">
                <li>Martial arts, climbing, parkour and ninja obstacles</li>
                <li>Jump, roll and movement fundamentals</li>
                <li>Drop-in all day, every day</li>
                <li>1-on-1 Guides available for younger children</li>
                <li>2-hour sessions with game room combo option</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#ffe033] text-sm mb-1">Adult Programs</p>
              <ul className="text-sm text-white/90 flex flex-col gap-1">
                <li>Morning (8am) and evening (8pm) sessions</li>
                <li>Martial arts fitness with climbing and kicking</li>
                <li>Full obstacle course training</li>
                <li>Advance booking required, no drop-ins</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-[#ffe033] text-sm mb-1">Ninja Day Camps (10am to 2pm)</p>
              <ul className="text-sm text-white/90 flex flex-col gap-1">
                <li>4-hour supervised ninja training session</li>
                <li>Drop-in before 2pm (see Join for pricing)</li>
                <li>Includes climbing, parkour and obstacle courses</li>
                <li>Jump and roll fundamentals with active Guides</li>
                <li>Multi-session cards available with discount</li>
                <li>Book via Join or MY MEMBERSHIP</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Game Rooms */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-1">Game Rooms</h2>
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wide">
            Day Camp, All Day Pass and Combo members
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Eligible members get access to two dedicated game rooms where kids can relax, socialise and play between or after training sessions.
          </p>

          <div className="flex flex-col gap-3">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="font-bold text-[#1a56db] text-sm mb-1">Video Game Room</p>
              <p className="text-sm text-gray-600 leading-relaxed mb-2">
                Gaming consoles and computers, including Minecraft. Kids can play, build and explore in a fun supervised space.
              </p>
              <a
                href="https://www.ricktew.com/ninjagym/ninja-day-camp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-[#1a56db] font-semibold underline"
              >
                Why Minecraft is great for kids
              </a>
            </div>

            <div className="bg-green-50 rounded-xl p-4">
              <p className="font-bold text-green-700 text-sm mb-1">Creative Learning Room</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                A quieter space with Montessori-style activities: drawing, playing house, chess, building blocks and other hands-on creative play.
              </p>
            </div>
          </div>
        </div>

        {/* Event Space */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-1">Event Space Rental</h2>
          <p className="text-xs text-orange-600 font-semibold mb-3 bg-orange-50 rounded-lg px-3 py-2">
            Weekends and holidays: available after 2pm only (Day Camps run until 2pm)
          </p>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: "Weekends and holidays (after 2pm)", price: "5,000 THB/hr" },
              { label: "Weekdays 3:30pm to 6:30pm", price: "5,000 THB/hr" },
              { label: "Weekdays 9am to 3pm and 6:30pm to 9:30pm", price: "3,000 THB/hr" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-600 flex-1 pr-3">{r.label}</span>
                <span className="font-bold text-[#1a56db] shrink-0">{r.price}</span>
              </div>
            ))}
          </div>
          <Link href="/birthdays" className="block mt-4 text-center text-sm text-[#1a56db] font-semibold underline">
            Book an Event
          </Link>
        </div>

        {/* Registration note */}
        <div className="bg-[#ffe033] rounded-2xl p-4 shadow">
          <p className="text-sm font-bold text-[#1a56db] mb-1">Registration</p>
          <p className="text-sm text-[#1a56db]">
            Advance registration recommended. Bring your email receipt or show your QR card. Membership is prepared upon arrival.
          </p>
        </div>

      </div>

      {/* CTA */}
      <Link
        href="/join"
        className="block bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-xl rounded-2xl py-4 text-center shadow-lg hover:brightness-110 transition-all"
      >
        JOIN NINJAGYM
      </Link>
    </div>
  );
}
