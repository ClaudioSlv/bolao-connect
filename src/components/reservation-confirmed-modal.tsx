"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReservationConfirmedModal({
  token,
  open,
}: {
  token: string;
  open: boolean;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(open);

  if (!visible) return null;

  function close() {
    setVisible(false);
    router.replace(`/p/${token}`, { scroll: false });
  }

  return (
    <div
      className="reservation-confirmed-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-confirmed-title"
    >
      <div className="reservation-confirmed-card">
        <div className="reservation-confirmed-icon" aria-hidden="true">
          ✓
        </div>
        <h2 id="reservation-confirmed-title">Parabéns!</h2>
        <p>Sua reserva no bolão foi confirmada.</p>
        <button className="button primary" type="button" onClick={close}>
          OK
        </button>
      </div>
    </div>
  );
}
