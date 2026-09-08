import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PwaRegister } from "@/components/pwa-register";
import { LotteryResultsTicker } from "@/components/lottery-results-ticker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bolão Amigos BTP", template: "%s · Bolão Amigos BTP" },
  description: "Organize bolões, cotas, pagamentos, jogos e conferências em um só lugar.",
  manifest: "/manifest.webmanifest",
  applicationName: "Bolão Amigos BTP",
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
  return <html lang="pt-BR"><body><header className="app-brandbar"><Link href="/" aria-label="Bolão Amigos BTP - início"><img src="/icon.svg" alt=""/><span>Bolão Amigos BTP</span></Link></header>{children}<LotteryResultsTicker/><PwaRegister /></body></html>;
}
