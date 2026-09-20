"use client";

import { useEffect } from "react";

export function ParticipantActivityTracker({ token }: { token: string }) {
  useEffect(() => {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  }, [token]);
  return null;
}
