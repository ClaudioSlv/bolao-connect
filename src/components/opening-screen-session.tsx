"use client";

import { useEffect } from "react";

const KEY = "juntasorte:participant-opening-shown";
let shown = false;

export function claimOpeningScreen() {
  if (shown) return false;
  try {
    if (sessionStorage.getItem(KEY) === "1") { shown = true; return false; }
    sessionStorage.setItem(KEY, "1");
  } catch { /* The in-memory guard still prevents repeated internal openings. */ }
  shown = true;
  return true;
}

export function OpeningScreenComplete() {
  useEffect(() => {
    shown = true;
    try { sessionStorage.setItem(KEY, "1"); } catch {}
  }, []);
  return null;
}
