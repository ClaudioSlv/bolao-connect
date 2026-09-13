"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CONFETTI_COLORS = [
  "#f7c948",
  "#62f48d",
  "#44a8ff",
  "#ff5e78",
  "#ffffff",
  "#b86cff",
];

export function ReservationConfirmedModal({
  token,
  accepted,
  justAccepted,
}: {
  token: string;
  accepted: boolean;
  justAccepted: boolean;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(justAccepted);

  useEffect(() => {
    if (!accepted) return;
    const key = `reservation-confirmed:${token}`;
    if (justAccepted || !window.localStorage.getItem(key)) setVisible(true);
  }, [accepted, justAccepted, token]);

  if (!visible) return null;

  function close() {
    window.localStorage.setItem(`reservation-confirmed:${token}`, "1");
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
      <div className="reservation-confetti" aria-hidden="true">
        {Array.from({ length: 30 }, (_, index) => (
          <span
            key={index}
            style={{
              left: `${(index * 37) % 100}%`,
              backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
              animationDelay: `${((index * 7) % 6) / 10}s`,
              transform: `rotate(${index * 29}deg)`,
            }}
          />
        ))}
      </div>
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
