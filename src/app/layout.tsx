import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PwaRegister } from "@/components/pwa-register";
import { LotteryResultsTicker } from "@/components/lottery-results-ticker";
import { PdfGameShare } from "@/components/pdf-game-share";
import { AppSplash } from "@/components/app-splash";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bolao-connect.vercel.app"),
  title: { default: "JuntaSorte", template: "%s · JuntaSorte" },
  description: "Participe dos nossos bolões e acompanhe tudo pelo app.",
  manifest: "/manifest.webmanifest",
  applicationName: "JuntaSorte",
  icons: {
    icon: [
      { url: "/juntasorte-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/juntasorte-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/juntasorte-icon-192.png",
    apple: [{ url: "/juntasorte-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/bolao",
    siteName: "JuntaSorte",
    title: "JuntaSorte",
    description: "Participe dos nossos bolões e acompanhe tudo pelo app.",
    images: [{url:"/juntasorte-logo-mark.jpg",alt:"Logo do JuntaSorte"}],
  },
  twitter: {
    card: "summary",
    title: "JuntaSorte",
    description: "Participe dos nossos bolões e acompanhe tudo pelo app.",
    images: ["/juntasorte-logo-mark.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#07110b",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body><AppSplash/><div className="app-fixed-header"><header className="app-brandbar"><Link href="/" aria-label="JuntaSorte - início"><img src="/juntasorte-logo-mark.jpg" alt=""/><span>JuntaSorte</span></Link></header><LotteryResultsTicker/></div>{children}<PdfGameShare/><PwaRegister /></body></html>;
}
