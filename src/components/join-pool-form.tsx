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
  specialLotofacil?: boolean;
};

export function JoinPoolForm({
  action,
  slug,
  rules,
  defaultName = "",
  defaultPhone = "",
  defaultShares = "1",
  isWaitlist,
  specialLotofacil = false,
}: JoinPoolFormProps) {
  const [rulesOpened, setRulesOpened] = useState(false);
  const [rulesAgreed, setRulesAgreed] = useState(false);
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
          {specialLotofacil && (
            <div style={{ marginBottom: "1.25rem", paddingBottom: "1.25rem", borderBottom: "1px solid rgba(247,201,72,.35)" }}>
              <strong style={{ display: "block", marginBottom: ".65rem", color: "#f7c948" }}>🍀 COMO FUNCIONA ESTE BOLÃO DA LOTOFÁCIL</strong>
              <span style={{ whiteSpace: "pre-line" }}>Este bolão é realizado a cada 20 concursos da Lotofácil, sempre nos concursos com final 0. Exemplo: 3800 → 3820 → 3840 → 3860...

Os jogos do bolão são gerados com 15 dezenas. Por esse motivo, não existe uma cota vinculada a um jogo específico para cada participante. Todos os participantes fazem parte do conjunto de jogos registrados para aquele bolão.

O organizador é responsável por registrar oficialmente os jogos e publicar no JuntaSorte as imagens dos bilhetes/comprovantes correspondentes ao bolão.

📷 Para conferir os bilhetes: acesse o Painel do Participante → BILHETES DO BOLÃO.

Importante: os jogos exibidos ou gerados no JuntaSorte só são considerados apostas oficiais depois de devidamente registrados em um canal autorizado.</span>
            </div>
          )}
          <span style={{ whiteSpace: "pre-line" }}>{rules}</span>
        </div>
        {rulesOpened && (
          <label style={{ marginTop: "1rem" }}>
            <input
              type="checkbox"
              name="rules_agreed"
              required
              disabled={submitting}
              checked={rulesAgreed}
              onChange={(event) => setRulesAgreed(event.target.checked)}
            />{" "}
            Li e estou de acordo com as Regras do Grupo.
          </label>
        )}
      </details>
      {!rulesOpened && (
        <p className="muted">
          Abra as regras acima para liberar a confirmação.
        </p>
      )}
      {rulesOpened && !rulesAgreed && (
        <p className="muted">
          Leia até o final e marque a caixa para liberar a reserva.
        </p>
      )}
      {rulesAgreed && (
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting
            ? "AGUARDE..."
            : isWaitlist
              ? "CONTINUAR"
              : "CONFIRMAR VAGA"}
        </button>
      )}
    </form>
  );
}
