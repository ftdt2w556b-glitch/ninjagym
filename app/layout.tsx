import type { Metadata, Viewport } from "next";
import { Nunito, Bangers, Fredoka } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const bangers = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bangers",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NinjaGym",
  description: "Rick Tew's NinjaGym — Koh Samui, Thailand. Kids ninja training, parkour, climbing and more.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NinjaGym",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a56db",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${bangers.variable} ${fredoka.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
