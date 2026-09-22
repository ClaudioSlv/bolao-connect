"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_NUMBERS = [8, 25, 33, 49, 59, 6];

function drawNumbers() {
  const available = Array.from({ length: 60 }, (_, index) => index + 1);
  for (let index = available.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [available[index], available[target]] = [available[target], available[index]];
  }
  return available.slice(0, 6);
}

export function MegaAnimatedCover({
  src,
  alt,
  animate = true,
}: {
  src: string;
  alt: string;
  animate?: boolean;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [numbers, setNumbers] = useState(INITIAL_NUMBERS);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!animate || !visible) return;
    const timer = window.setInterval(() => setNumbers(drawNumbers()), 2800);
    return () => window.clearInterval(timer);
  }, [animate, visible]);

  return (
    <span ref={rootRef} className="mega-pool-cover">
      <img src={src} alt={alt} />
      {animate ? (
        <span className="mega-globe-animation" aria-hidden="true">
          {numbers.map((number, index) => (
            <span className={`mega-globe-ball mega-globe-ball-${index + 1}`} key={index}>
              {String(number).padStart(2, "0")}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
