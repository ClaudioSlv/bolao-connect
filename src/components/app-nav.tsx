"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: "home" | "people" | "wallet" | "games";
};

const items: NavItem[] = [
  {href: "/", label: "Início", icon: "home"},
  {href: "/participantes", label: "Pessoas", icon: "people"},
  {href: "/carteira", label: "Carteira", icon: "wallet"},
  {href: "/jogos", label: "Jogos", icon: "games"},
];

function NavIcon({name}: {name: NavItem["icon"]}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></svg>;
  if (name === "people") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13a5.5 5.5 0 0 1 5.5 5.5V20"/><circle cx="17.5" cy="9" r="2.2"/><path d="M16 14.2a4.5 4.5 0 0 1 4.5 4.5V20"/></svg>;
  if (name === "wallet") return <svg {...common}><path d="M4 6.5h14a2 2 0 0 1 2 2V19H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12"/><path d="M20 11h-5a2 2 0 0 0 0 4h5"/><circle cx="15.5" cy="13" r=".5" fill="currentColor" stroke="none"/></svg>;
  return <svg {...common}><path d="M5 4h14a2 2 0 0 1 2 2v4a2.5 2.5 0 0 0 0 5v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2.5 2.5 0 0 0 0-5V6a2 2 0 0 1 2-2Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>;
}

export function AppNav() {
  const pathname = usePathname();

  return <nav className="nav" aria-label="Navegação principal">
    {items.map((item) => {
      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      return <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
        <span className="nav-icon"><NavIcon name={item.icon}/></span>
        <span className="nav-label">{item.label}</span>
      </Link>;
    })}
  </nav>;
}
