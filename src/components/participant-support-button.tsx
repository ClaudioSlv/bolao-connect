"use client";

import { FormEvent, useRef, useState } from "react";

export function ParticipantSupportButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setStatus("Enviando sua mensagem...");
    try {
      const response = await fetch("/api/support-messages", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar.");
      formRef.current?.reset();
      setStatus("Mensagem enviada ao organizador com sucesso!");
      window.setTimeout(() => { setOpen(false); setStatus(""); }, 1800);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button className="participant-support-fab" type="button" onClick={() => setOpen(true)} aria-label="Enviar mensagem ao organizador">
        <span aria-hidden="true">💬</span><span className="participant-support-dot" />
      </button>
      {open ? (
        <div className="participant-support-overlay" role="dialog" aria-modal="true" aria-labelledby="support-title">
          <form ref={formRef} className="participant-support-modal" onSubmit={submit}>
            <button className="participant-support-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            <h2 id="support-title">Fale com o organizador</h2>
            <p className="muted">Envie uma dúvida, sugestão ou informe um problema no app.</p>
            <input type="hidden" name="token" value={token} />
            <label className="field">Tipo da mensagem<select name="category" defaultValue="help" required><option value="help">Ajuda ou dúvida</option><option value="bug">Informar um bug</option><option value="suggestion">Enviar uma sugestão</option></select></label>
            <label className="field">Mensagem<textarea name="message" minLength={5} maxLength={1500} rows={5} required placeholder="Conte o que aconteceu ou escreva sua sugestão..." /></label>
            <label className="participant-support-file">📎 Anexar print ou imagem<input name="attachment" type="file" accept="image/jpeg,image/png,image/webp" /></label>
            <small className="muted">Imagem opcional de até 5 MB.</small>
            {status ? <p className="status" role="status">{status}</p> : null}
            <button className="button primary" type="submit" disabled={sending}>{sending ? "ENVIANDO..." : "ENVIAR MENSAGEM"}</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
