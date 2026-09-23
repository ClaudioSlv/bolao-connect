"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ORGANIZER_ACTIVE_POOL_COOKIE } from "@/lib/active-pool-cookie";

export function PersistentPoolLink({
  poolId,
  children,
  className,
  style,
  ariaLabel,
}: {
  poolId: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const rememberPool = () => {
    document.cookie = `${ORGANIZER_ACTIVE_POOL_COOKIE}=${encodeURIComponent(poolId)}; Max-Age=31536000; Path=/; SameSite=Lax`;
  };

  return (
    <Link
      href={`/?pool=${encodeURIComponent(poolId)}`}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={rememberPool}
    >
      {children}
    </Link>
  );
}

