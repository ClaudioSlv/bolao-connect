"use client";

import { useState } from "react";

type JoinPoolFormProps = {
  action: (formData: FormData) => Promise<void>;
  slug: string;
  rules: string;
  defaultName?: string;
  defaultPhone?: string;
  defaultShares?: string;
  isWaitlist: boolean;
};

export function JoinPoolForm({
  action,
  slug,
  rules,
  defaultName = "",
  defaultPhone = "",
  defaultShares = "1",
  isWaitlist,
}: JoinPoolFormProps) {
  const [rulesOpened, setRulesOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="form"
      action={action}
      onSubmit={() => setSubmitting(true)}
      aria-busy={submitting}
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="field">
        <label>Seu nome</label>
        <input
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          defaultValue={defaultName}
          placeholder="Nome completo"
          disabled={submitting}
        />
      </div>
      <div className="field">
        <label>WhatsApp com DDD</label>
        <input
          name="phone"
          required
          inputMode="tel"
          autoComplete="tel"
          defaultValue={defaultPhone}
          placeholder="(13) 99999-9999"
          disabled={submitting}
        />
      </div>
      <div className="field">
        <label>Quantidade de cotas (máximo 2)</label>
        <select
          name="shares"
          defaultValue={defaultShares}
          disabled={submitting}
        >
          <option value="1">1 cota</option>
          <option value="2">2 cotas</option>
        </select>
      </div>

      <div className="rules-required-notice">
        <strong>LEITURA OBRIGATÓRIA</strong>
        <span>
          Abra as regras do grupo e confirme a leitura antes de reservar sua
          vaga.
        </span>
      </div>
      <details
        className="rules-disclosure"
        onToggle={(event) => {
          if (event.currentTarget.open) setRulesOpened(true);
        }}
      >
        <summary>ABRIR E LER AS REGRAS DO GRUPO</summary>
        <div className="card">
          <span style={{ whiteSpace: "pre-line" }}>{rules}</span>
        </div>
      </details>
      <label>
        <input
          type="checkbox"
          name="rules_agreed"
          required
          disabled={!rulesOpened || submitting}
        />{" "}
        Li e estou de acordo com as Regras do Grupo.
      </label>
      {!rulesOpened && (
        <p className="muted">
          Abra as regras acima para liberar a confirmação.
        </p>
      )}

      <button
        className="button primary"
        type="submit"
        disabled={!rulesOpened || submitting}
      >
        {submitting
          ? "AGUARDE..."
          : isWaitlist
            ? "CONTINUAR"
            : "CONFIRMAR VAGA"}
      </button>
    </form>
  );
}
