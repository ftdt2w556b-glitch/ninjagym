"use client";

import { useState } from "react";
import Link from "next/link";
import PublicPageHeader from "@/components/public/PublicPageHeader";

const GAMING_ZONE_NOTE =
  "Booking an Event at NinjaGym is only for the Main Activity Zones and does not include the Gaming Zones. Although your event is private for you only, we keep the game rooms open for other guests at all hours.";

export default function AboutPage() {
  const [minecraftOpen, setMinecraftOpen] = useState(false);

  return (
    <div className="px-4 py-6 text-white">
      <PublicPageHeader />

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">About NinjaGym</h1>
      <p className="text-[#ffe033] font-bold tracking-wide mb-6">RICK TEW&apos;S NINJAGYM, KOH SAMUI</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { stat: "30+", label: "Years Teaching" },
          { stat: "5",   label: "Winjitsu Books" },
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
            {/* Video Game Room */}
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="font-bold text-[#1a56db] text-sm mb-1">Video Game Room</p>
              <p className="text-sm text-gray-600 leading-relaxed mb-2">
                Gaming consoles and computers, including Minecraft. Kids can play, build and explore in a fun supervised space.
              </p>

              {/* Minecraft expandable — in-app, no external link */}
              <button
                onClick={() => setMinecraftOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-xs text-[#1a56db] font-semibold underline"
              >
                {minecraftOpen ? "▲ Hide" : "▶ Why Minecraft is great for kids"}
              </button>

              {minecraftOpen && (
                <div className="mt-3 bg-white rounded-xl p-4 border border-blue-100 text-sm text-gray-600 flex flex-col gap-2">
                  <p className="font-bold text-[#1a56db]">Why Minecraft is great for kids</p>
                  <p>Minecraft isn&apos;t just a game — it&apos;s a creative and educational platform that develops real-world skills:</p>
                  <ul className="flex flex-col gap-1.5 pl-1">
                    {[
                      "🧱 Creativity & problem solving — building from scratch develops spatial thinking and design skills",
                      "🤝 Teamwork — multiplayer modes teach kids to collaborate, delegate and plan together",
                      "📐 Math & geometry — calculating areas, volumes and resources is built into gameplay",
                      "💡 Logical thinking — redstone circuits introduce kids to basic engineering and coding concepts",
                      "🌍 Exploration & curiosity — open-world environments encourage discovery and risk-taking",
                      "😌 Safe digital space — no violence or harmful content; staff supervised at all times",
                    ].map((item) => (
                      <li key={item} className="leading-snug">{item}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 mt-1">Available during Game Room hours for eligible members.</p>
                </div>
              )}
            </div>

            {/* Creative Learning Room */}
            <div className="bg-green-50 rounded-xl p-4">
              <p className="font-bold text-green-700 text-sm mb-1">Creative Learning Room</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                A quieter space with Montessori-style activities: drawing, playing house, chess, building blocks and other hands-on creative play.
              </p>
            </div>
          </div>
        </div>

        {/* Event Space Rental */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="font-bold text-[#1a56db] text-lg mb-1">Event Space Rental</h2>
          <p className="text-xs text-orange-600 font-semibold mb-3 bg-orange-50 rounded-lg px-3 py-2">
            Weekends and holidays: available after 2pm only (Day Camps run until 2pm)
          </p>

          {/* Gaming zone notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-yellow-800 leading-relaxed">
              ⚠️ {GAMING_ZONE_NOTE}
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm mb-4">
            {[
              { label: "Weekends and holidays (after 2pm)", price: "5,000 THB/hr" },
              { label: "Weekdays 3:30pm to 6:30pm",         price: "5,000 THB/hr" },
              { label: "Weekdays 9am to 3pm and 6:30pm to 9:30pm", price: "3,000 THB/hr" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-600 flex-1 pr-3">{r.label}</span>
                <span className="font-bold text-[#1a56db] shrink-0">{r.price}</span>
              </div>
            ))}
          </div>

          <Link
            href="/event-space"
            className="block text-center bg-[#1a56db] text-white font-bold text-sm rounded-xl py-3 hover:bg-blue-700 transition-colors"
          >
            Book an Event Space →
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
