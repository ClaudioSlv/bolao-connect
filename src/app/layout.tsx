import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PwaRegister } from "@/components/pwa-register";
import { LotteryResultsTicker } from "@/components/lottery-results-ticker";
import { PdfGameShare } from "@/components/pdf-game-share";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bolao-connect.vercel.app"),
  title: { default: "Bolão Amigos BTP", template: "%s · Bolão Amigos BTP" },
  description: "Participe dos nossos bolões e acompanhe tudo pelo app.",
  manifest: "/manifest.webmanifest",
  applicationName: "Bolão Amigos BTP",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/bolao",
    siteName: "Bolão Amigos BTP",
    title: "🍀 Bolão Amigos BTP",
    description: "Participe dos nossos bolões e acompanhe tudo pelo app.",
    images: [{url:"/icon.svg",width:512,height:512,alt:"Bolão Amigos BTP"}],
  },
  twitter: {
    card: "summary_large_image",
    title: "🍀 Bolão Amigos BTP",
    description: "Participe dos nossos bolões e acompanhe tudo pelo app.",
    images: ["/icon.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#07110b",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body><header className="app-brandbar"><Link href="/" aria-label="Bolão Amigos BTP - início"><img src="/icon.svg" alt=""/><span>Bolão Amigos BTP</span></Link></header><LotteryResultsTicker/>{children}<PdfGameShare/><PwaRegister /></body></html>;
}
