"use client";

import { useState } from "react";

export function RulesAcceptanceForm({
  token,
  action,
}: {
  token: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="form"
      action={action}
      onSubmit={() => setSubmitting(true)}
      aria-busy={submitting}
    >
      <input type="hidden" name="token" value={token} />
      <label>
        <input type="checkbox" name="agreed" required disabled={submitting} />{" "}
        Li e estou de acordo com as Regras do Grupo.
      </label>
      {submitting ? (
        <div
          className="rules-validation-status"
          role="status"
          aria-live="polite"
        >
          <span className="rules-validation-spinner" aria-hidden="true" />
          <strong>Aguarde, estamos validando a sua participação...</strong>
        </div>
      ) : (
        <button className="button primary" type="submit">
          ACEITAR AS REGRAS
        </button>
      )}
    </form>
  );
}
