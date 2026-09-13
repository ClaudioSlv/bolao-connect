"use client";
import { useState } from "react";

export function BackupRestoreForm({ poolId }: { poolId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function restore(form: FormData) {
    const file = form.get("backup") as File;
    if (!file?.size) return setMessage("Escolha o arquivo de backup.");
    if (file.size > 5_000_000) return setMessage("O arquivo ultrapassa 5 MB.");
    setBusy(true);
    setMessage("Validando e restaurando os registros ausentes...");
    try {
      const response = await fetch(
        `/api/admin/backup/restore?pool=${encodeURIComponent(poolId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: await file.text(),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Falha na restauração.");
      setMessage(
        `✓ Restauração concluída: ${result.restored} registros recuperados.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha na restauração.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" action={restore}>
      <div className="field">
        <label>Arquivo de backup (.json)</label>
        <input
          type="file"
          name="backup"
          accept="application/json,.json"
          required
        />
      </div>
      <label className="list-item" style={{ justifyContent: "flex-start" }}>
        <input type="checkbox" required style={{ width: 22, height: 22 }} />{" "}
        Confirmo que selecionei o backup deste bolão.
      </label>
      <button className="button secondary" disabled={busy}>
        {busy ? "AGUARDE..." : "RESTAURAR REGISTROS AUSENTES"}
      </button>
      {message && <p className="status">{message}</p>}
    </form>
  );
}
