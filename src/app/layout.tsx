import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolão Connect",
  description: "Organize bolões, cotas, pagamentos, jogos e conferências em um só lugar.",
  manifest: "/manifest.webmanifest",
  applicationName: "Bolão Connect",
};

export const viewport: Viewport = {
  themeColor: "#07110b",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body>{children}<PwaRegister /></body></html>;
}
