"use client";
import { useRef, useState } from "react";
export function ReceiptViewer({
  title,
  url,
  viewEvent,
}: {
  title: string;
  url: string;
  viewEvent?: { token: string; receiptId: string };
}) {
  const [open, setOpen] = useState(false),
    reported = useRef(false);
  const openReceipt = () => {
    setOpen(true);
    if (viewEvent && !reported.current) {
      reported.current = true;
      void fetch("/api/game-receipts/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(viewEvent),
        keepalive: true,
      });
    }
  };
  return (
    <div className="receipt-document">
      <button type="button" className="receipt-open" onClick={openReceipt}>
        <span className="receipt-thumb">
          <img src={url} alt="Prévia do comprovante" />
        </span>
        <span>
          <strong>{title}</strong>
          <small>Toque para abrir em tela cheia</small>
        </span>
        <b>›</b>
      </button>
      {open && (
        <div
          className="receipt-viewer-overlay receipt-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <header>
            <strong>{title}</strong>
          </header>
          <p>Use dois dedos para ampliar. Arraste em qualquer direção.</p>
          <div className="receipt-pan">
            <img src={url} alt={title} />
          </div>
          <footer>
            <button
              type="button"
              className="button primary receipt-close"
              onClick={() => setOpen(false)}
            >
              Fechar comprovante
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
