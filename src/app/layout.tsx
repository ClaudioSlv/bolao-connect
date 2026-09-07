import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PwaRegister } from "@/components/pwa-register";
import { ParticipantReminderGate } from "@/components/participant-reminder-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bolão Connect", template: "%s · Bolão Connect" },
  description: "Organize bolões, cotas, pagamentos, jogos e conferências em um só lugar.",
  manifest: "/manifest.webmanifest",
  applicationName: "Bolão Connect",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#07110b",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body><header className="app-brandbar"><Link href="/" aria-label="Bolão Connect - início"><img src="/icon.svg" alt=""/><span>Bolão Connect</span></Link></header>{children}<ParticipantReminderGate/><PwaRegister /></body></html>;
}
