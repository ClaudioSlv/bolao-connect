"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CapacityResult = {
  ok: boolean;
  message: string;
};

type CapacityFormProps = {
  poolId: string;
  currentTotal: number;
  occupiedShares: number;
  action: (formData: FormData) => Promise<CapacityResult>;
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function CapacityForm({
  poolId,
  currentTotal,
  occupiedShares,
  action,
}: CapacityFormProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setStatus("saving");
    setMessage("Aguarde, estamos salvando a alteração...");

    try {
      const formData = new FormData(event.currentTarget);
      const [result] = await Promise.all([action(formData), wait(3000)]);

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        submittingRef.current = false;
        return;
      }

      setStatus("success");
      setMessage("Alteração salva com sucesso.");
      router.refresh();
      await wait(3000);
      setStatus("idle");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Não foi possível salvar a alteração. Tente novamente.");
    } finally {
      submittingRef.current = false;
    }
  }

  const busy = status === "saving" || status === "success";

  return (
    <form className="form" onSubmit={handleSubmit}>
      <input type="hidden" name="poolId" value={poolId} />
      <div className="field">
        <label>Corrigir total de cotas</label>
        <input
          name="totalShares"
          type="number"
          min={occupiedShares}
          max="100000"
          placeholder={`Total atual: ${currentTotal}`}
          required
          disabled={busy}
        />
        <span className="muted">
          Atual: {currentTotal}. O total nunca poderá ficar abaixo das{" "}
          {occupiedShares} cotas ocupadas.
        </span>
      </div>
      <label>
        <input
          type="checkbox"
          name="confirmCapacity"
          required
          disabled={busy}
        />{" "}
        Eu confirmo a alteração do total de cotas.
      </label>

      {status === "idle" || status === "error" ? (
        <button className="button primary" type="submit">
          Salvar total de cotas
        </button>
      ) : null}

      {status !== "idle" ? (
        <div
          className={status === "error" ? "status error" : "status"}
          role="status"
          aria-live="polite"
          style={{ marginTop: 12 }}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
