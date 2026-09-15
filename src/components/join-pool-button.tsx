"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./join-pool-button.module.css";

export function JoinPoolButton({
  href,
  label = "🍀 PARTICIPAR DO BOLÃO",
  pulse = true,
}: {
  href: string;
  label?: string;
  pulse?: boolean;
}) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);
  const proceed = () => {
    if (waiting) return;
    setWaiting(true);
    router.push(href);
  };
  return (
    <button
      type="button"
      className={`button primary ${pulse && !waiting ? styles.pulse : ""} ${styles.button}`}
      disabled={waiting}
      onClick={proceed}
    >
      {waiting ? (
        <span className={styles.waiting}>
          AGUARDE{" "}
          <span className={styles.dots} aria-label="carregando">
            <i />
            <i />
            <i />
          </span>
        </span>
      ) : (
        label
      )}
    </button>
  );
}
