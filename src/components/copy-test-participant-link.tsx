"use client";
import { useState } from "react";
export function CopyTestParticipantLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const link = `${window.location.origin}/teste-pagamento/participar/${token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }
  return (
    <button className="button primary" type="button" onClick={copy}>
      {copied ? "✓ LINK COPIADO" : "COPIAR LINK · PARTICIPAR DO BOLÃO"}
    </button>
  );
}
