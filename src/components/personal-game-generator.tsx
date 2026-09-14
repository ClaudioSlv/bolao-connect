"use client";
import { useMemo, useState } from "react";
import { officialGamesCostCents } from "@/lib/lottery-pricing";
type Lottery =
  | "mega-sena"
  | "lotofacil"
  | "quina"
  | "dupla-sena"
  | "lotomania"
  | "timemania"
  | "dia-de-sorte"
  | "super-sete"
  | "mais-milionaria";
type Result = { numbers: number[]; special_value?: unknown; contest_number: number };
type Game = { numbers: number[]; trevos: number[] };
const rules: Record<
  Lottery,
  { label: string; min: number; max: number; minPick: number; maxPick: number }
> = {
  "mega-sena": { label: "Mega-Sena", min: 1, max: 60, minPick: 6, maxPick: 20 },
  lotofacil: { label: "Lotofácil", min: 1, max: 25, minPick: 15, maxPick: 20 },
  quina: { label: "Quina", min: 1, max: 80, minPick: 5, maxPick: 15 },
  "dupla-sena": {
    label: "Dupla Sena",
    min: 1,
    max: 50,
    minPick: 6,
    maxPick: 15,
  },
  lotomania: { label: "Lotomania", min: 0, max: 99, minPick: 50, maxPick: 50 },
  timemania: { label: "Timemania", min: 1, max: 80, minPick: 10, maxPick: 10 },
  "dia-de-sorte": {
    label: "Dia de Sorte",
    min: 1,
    max: 31,
    minPick: 7,
    maxPick: 15,
  },
  "super-sete": { label: "Super Sete", min: 0, max: 9, minPick: 7, maxPick: 7 },
  "mais-milionaria": {
    label: "+Milionária",
    min: 1,
    max: 50,
    minPick: 6,
    maxPick: 12,
  },
};
const shuffle = <T,>(a: T[]) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const fibonacciUpTo = (max: number) => {
  const out = new Set<number>();
  let a = 1,
    b = 2;
  while (a <= max) {
    out.add(a);
    [a, b] = [b, a + b];
  }
  return out;
};
const primesUpTo = (max: number) => {
  const out = new Set<number>();
  for (let n = 2; n <= max; n++) {
    let prime = true;
    for (let divisor = 2; divisor * divisor <= n; divisor++) {
      if (n % divisor === 0) {
        prime = false;
        break;
      }
    }
    if (prime) out.add(n);
  }
  return out;
};
export function PersonalGameGenerator({
  lottery,
  results,
  latestContest,
  participantToken,
  returnHref,
}: {
  lottery: Lottery;
  results: Result[];
  latestContest: number | null;
  participantToken: string | null;
  returnHref: string;
}) {
  const r = rules[lottery];
  const [pick, setPick] = useState(r.minPick),
    [pickInput, setPickInput] = useState(""),
    [qty, setQty] = useState(1),
    [qtyInput, setQtyInput] = useState(""),
    [manual, setManual] = useState<number[]>([]),
    [games, setGames] = useState<Game[]>([]),
    [savedGamesOnPage, setSavedGamesOnPage] = useState<Game[]>([]),
    [excludedOdd, setExcludedOdd] = useState<number[]>([]),
    [excludedEven, setExcludedEven] = useState<number[]>([]),
    [excludedPrimes, setExcludedPrimes] = useState<number[]>([]),
    [exclusionError, setExclusionError] = useState(""),
    [trevoPick, setTrevoPick] = useState(2),
    [manualTrevos, setManualTrevos] = useState<number[]>([]),
    [saved, setSaved] = useState(false),
    [shared, setShared] = useState(false),
    [showSaveDialog, setShowSaveDialog] = useState(false);
  const allNumbers = useMemo(
    () => Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i),
    [r.min, r.max],
  );
  const oddNumbers = useMemo(
    () => allNumbers.filter((n) => n % 2 !== 0),
    [allNumbers],
  );
  const evenNumbers = useMemo(
    () => allNumbers.filter((n) => n % 2 === 0),
    [allNumbers],
  );
  const exclusionLimit = Math.max(1, Math.floor((r.max - r.min + 1) / 4));
  const visibleGames = [...savedGamesOnPage, ...games];
  const excluded = new Set([...excludedOdd, ...excludedEven, ...excludedPrimes]);
  const available = allNumbers.filter((n) => !excluded.has(n));
  const fibSet = useMemo(() => fibonacciUpTo(r.max), [r.max]);
  const primeSet = useMemo(() => primesUpTo(r.max), [r.max]);
  const primeNumbers = useMemo(
    () => allNumbers.filter((n) => primeSet.has(n)),
    [allNumbers, primeSet],
  );
  const stats = useMemo(() => {
    if (lottery === "super-sete") {
      const cols = Array.from({ length: 7 }, () => Array(10).fill(0));
      for (const d of results.slice(0, 50))
        d.numbers?.slice(0, 7).forEach((n, i) => {
          if (Number.isInteger(n) && n >= 0 && n <= 9) cols[i][n]++;
        });
      return {
        cols,
        freq: new Map<number, number>(),
        delay: new Map<number, number>(),
      };
    }
    const freq = new Map<number, number>(),
      delay = new Map<number, number>();
    for (let n = r.min; n <= r.max; n++) {
      freq.set(n, 0);
      delay.set(n, results.length);
    }
    for (const [index, d] of results.slice(0, 50).entries())
      for (const n of d.numbers ?? []) {
        freq.set(n, (freq.get(n) ?? 0) + 1);
        if (delay.get(n) === results.length) delay.set(n, index);
      }
    return { freq, delay, cols: [] };
  }, [results, lottery, r.min, r.max]);
  const ordered = useMemo(
    () =>
      lottery === "super-sete"
        ? []
        : [...stats.freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n),
    [stats, lottery],
  );
  const delayed = useMemo(
    () =>
      lottery === "super-sete"
        ? []
        : [...stats.delay.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([n]) => n),
    [stats, lottery],
  );
  const oneNumbers = () => {
    if (lottery === "super-sete") {
      const allowedDigits = allNumbers.filter((n) => !excluded.has(n));
      return stats.cols.map((c) => {
        const candidates = allowedDigits.length ? allowedDigits : allNumbers;
        const m = Math.max(...candidates.map((digit) => c[digit]), 1),
          w: number[] = [];
        for (const d of candidates)
          for (let i = 0; i < 1 + Math.round((c[d] / m) * 5); i++) w.push(d);
        return w[Math.floor(Math.random() * w.length)];
      });
    }
    const allowed = new Set(available),
      ranked = ordered.filter((n) => allowed.has(n)),
      hot = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.33))),
      cold = ranked.slice(Math.floor(ranked.length * 0.67)),
      late = delayed
        .filter((n) => allowed.has(n))
        .slice(0, Math.max(1, Math.ceil(available.length * 0.33))),
      fibs = available.filter((n) => fibSet.has(n)),
      primes = available.filter((n) => primeSet.has(n)),
      chosen = new Set<number>();
    const take = (a: number[], c: number) =>
      shuffle(a.filter((n) => !chosen.has(n)))
        .slice(0, c)
        .forEach((n) => chosen.add(n));
    if (results.length) {
      take(hot, Math.max(1, Math.round(pick * 0.3)));
      take(cold, Math.max(1, Math.round(pick * 0.18)));
      take(late, Math.max(1, Math.round(pick * 0.18)));
      take(primes, Math.max(1, Math.round(pick * 0.18)));
      take(fibs, Math.max(1, Math.round(pick * 0.2)));
    } else {
      take(fibs, Math.max(1, Math.round(pick * 0.2)));
      take(primes, Math.max(1, Math.round(pick * 0.18)));
    }
    for (const n of shuffle(available)) if (chosen.size < pick) chosen.add(n);
    return [...chosen].slice(0, pick).sort((a, b) => a - b);
  };
  const oneTrevos = () =>
    lottery === "mais-milionaria"
      ? manualTrevos.length === trevoPick
        ? [...manualTrevos]
        : shuffle([1, 2, 3, 4, 5, 6])
            .slice(0, trevoPick)
            .sort((a, b) => a - b)
      : [];
  const enteredPick = Number(pickInput),
    pickIsValid =
      pickInput !== "" &&
      Number.isInteger(enteredPick) &&
      enteredPick >= r.minPick &&
      enteredPick <= r.maxPick,
    pickError =
      pickInput === ""
        ? ""
        : enteredPick < r.minPick
          ? `O valor mínimo recomendado é ${r.minPick}.`
          : enteredPick > r.maxPick
            ? `O valor máximo permitido é ${r.maxPick}.`
            : !Number.isInteger(enteredPick)
              ? "Digite somente um número inteiro."
              : "";
  const enteredQty = Number(qtyInput),
    qtyIsValid =
      qtyInput !== "" &&
      Number.isInteger(enteredQty) &&
      enteredQty >= 1 &&
      enteredQty <= 1000,
    qtyError =
      qtyInput === ""
        ? ""
        : enteredQty < 1
          ? "A quantidade mínima é 1 jogo."
          : enteredQty > 1000
            ? "A quantidade máxima é 1.000 jogos."
            : !Number.isInteger(enteredQty)
              ? "Digite somente um número inteiro."
              : "";
  const canGenerate =
    pickIsValid &&
    qtyIsValid &&
    (lottery === "super-sete" || available.length >= pick);
  const resetFeedback = () => {
    setSaved(false);
    setShared(false);
  };
  const showGenerated = () =>
    setTimeout(
      () =>
        document
          .getElementById("generated-games")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  const auto = () => {
    if (canGenerate) {
      const wanted = Math.max(1, Math.min(1000, qty)),
        out: Game[] = [],
        seen = new Set<string>();
      let attempts = 0;
      while (out.length < wanted && attempts < wanted * 30) {
        attempts++;
        const game = { numbers: oneNumbers(), trevos: oneTrevos() },
          key = `${game.numbers.join("-")}|${game.trevos.join("-")}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(game);
        }
      }
      setGames(out);
      resetFeedback();
      showGenerated();
    }
  };
  const buildManualGames = (numbers: number[]) => {
    if (numbers.length !== pick) return;
    setGames([{ numbers: [...numbers], trevos: oneTrevos() }]);
    resetFeedback();
    showGenerated();
  };
  const requestPickQuantity = () => {
    alert("Você precisa primeiro selecionar a quantidade de números desejada.");
    const input = document.getElementById("pick-quantity-input") as HTMLInputElement | null;
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => input?.focus(), 450);
  };
  const focusGameQuantity = () => {
    const input = document.getElementById("game-quantity-input") as HTMLInputElement | null;
    input?.focus();
    input?.select();
  };
  const advanceToNumberSelection = (input: HTMLInputElement) => {
    if (!qtyIsValid) return;
    input.blur();
    setTimeout(
      () =>
        document
          .getElementById("manual-number-selection")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      180,
    );
  };
  const toggle = (n: number) => {
    if (!pickIsValid) {
      requestPickQuantity();
      return;
    }
    setManual((v) => {
      const next = v.includes(n)
        ? v.filter((x) => x !== n)
        : v.length < pick
          ? [...v, n].sort((a, b) => a - b)
          : v;
      if (next.length === pick) buildManualGames(next);
      else setGames([]);
      return next;
    });
  };
  const toggleTrevo = (n: number) => {
    setManualTrevos((v) =>
      v.includes(n)
        ? v.filter((x) => x !== n)
        : v.length < trevoPick
          ? [...v, n].sort((a, b) => a - b)
          : v,
    );
    setGames([]);
    resetFeedback();
  };
  const toggleExclude = (n: number, odd: boolean) => {
    const current = odd ? excludedOdd : excludedEven;
    const setter = odd ? setExcludedOdd : setExcludedEven;
    if (current.includes(n)) {
      setter(current.filter((x) => x !== n));
      setExclusionError("");
      return;
    }
    if (current.length >= exclusionLimit) return;
    if (!excluded.has(n) && available.length - 1 < pick) {
      setExclusionError(
        "Não sobraram dezenas suficientes. Desmarque algum número para criar o jogo.",
      );
      return;
    }
    setter([...current, n].sort((a, b) => a - b));
    setExclusionError("");
    setManual((v) => v.filter((x) => x !== n));
    setGames([]);
    resetFeedback();
  };
  const togglePrimeExclude = (n: number) => {
    if (excludedPrimes.includes(n)) {
      setExcludedPrimes((current) => current.filter((x) => x !== n));
      setExclusionError("");
      setGames([]);
      resetFeedback();
      return;
    }
    if (!excluded.has(n) && lottery !== "super-sete" && available.length - 1 < pick) {
      setExclusionError(
        "Não sobraram dezenas suficientes. Desmarque algum número para criar o jogo.",
      );
      return;
    }
    setExcludedPrimes((current) => [...current, n].sort((a, b) => a - b));
    setExclusionError("");
    setManual((current) => current.filter((x) => x !== n));
    setGames([]);
    resetFeedback();
  };
  const manualGames = () => buildManualGames(manual);
  const setValidPick = (raw: string) => {
    setPickInput(raw);
    const n = Number(raw);
    if (raw !== "" && Number.isInteger(n) && n >= r.minPick && n <= r.maxPick)
      setPick(n);
    setManual([]);
    setGames([]);
    setExcludedOdd([]);
    setExcludedEven([]);
    setExcludedPrimes([]);
    setExclusionError("");
    resetFeedback();
  };
  const gameText = (game: Game, i: number) =>
    `Jogo ${i + 1}: ${game.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")}${lottery === "mais-milionaria" ? ` | Trevos: ${game.trevos.map((n) => String(n).padStart(2, "0")).join(" · ")}` : ""}`;
  const shareText = () =>
    `🍀 ${r.label} — Bolão Amigos BTP\n\n${games.map(gameText).join("\n")}\n\nJogo gerado pelo Bolão Amigos BTP.`;
  const saveGames = async () => {
    try {
      const key = "bolao-amigos-btp:jogos-salvos";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      let targetContest = latestContest ? latestContest + 1 : null;

      if (!targetContest) {
        try {
          const response = await fetch("/api/lottery-ticker", { cache: "no-store" });
          const data = (await response.json().catch(() => null)) as {
            results?: Array<{ lottery?: string; contest?: number }>;
          } | null;
          const latest = data?.results?.find((result) => result.lottery === lottery);
          if (response.ok && Number(latest?.contest) > 0)
            targetContest = Number(latest?.contest) + 1;
        } catch {
          // A validação abaixo impede salvar um jogo sem concurso.
        }
      }

      if (participantToken) {
        try {
          const response = await fetch("/api/personal-games", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: participantToken,
              lottery,
              contest: targetContest,
              games,
            }),
          });
          const data = (await response.json().catch(() => null)) as {
            contest?: number;
            error?: string;
          } | null;
          if (!response.ok) throw new Error(data?.error);
          if (Number.isInteger(data?.contest) && Number(data?.contest) > 0)
            targetContest = Number(data?.contest);
        } catch (error) {
          alert(
            `${error instanceof Error && error.message ? error.message : "O jogo foi salvo no celular, mas a conferência em segundo plano não foi ativada."} O jogo continua disponível neste aparelho.`,
          );
        }
      }

      if (!targetContest) {
        alert(
          "Não foi possível identificar o próximo concurso. Verifique sua conexão e tente salvar novamente.",
        );
        return;
      }

      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        lottery,
        label: r.label,
        games,
        targetContest,
        totalCostCents: officialGamesCostCents(lottery, games),
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(
        key,
        JSON.stringify([entry, ...(Array.isArray(current) ? current : [])]),
      );

      setSaved(true);
      setShowSaveDialog(true);
    } catch {
      alert("Não foi possível salvar este jogo neste aparelho.");
    }
  };
  const createAnotherGame = () => {
    setSavedGamesOnPage((current) => [...current, ...games]);
    setGames([]);
    setManual([]);
    setManualTrevos([]);
    setSaved(false);
    setShowSaveDialog(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const shareGames = async () => {
    const text = shareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: `${r.label} — Bolão Amigos BTP`, text });
        setShared(true);
        setTimeout(() => setShared(false), 3000);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 3000);
        return;
      }
      window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    }
  };
  return (
    <div className="form">
      <div className="field">
        <label>
          Números por jogo{" "}
          <small className="muted">
            (mín. {r.minPick} · máx. {r.maxPick})
          </small>
        </label>
        <input
          id="pick-quantity-input"
          type="number"
          inputMode="numeric"
          enterKeyHint="next"
          min={r.minPick}
          max={r.maxPick}
          step="1"
          value={pickInput}
          placeholder={`Digite de ${r.minPick} a ${r.maxPick}`}
          onChange={(e) => setValidPick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !pickIsValid) return;
            e.preventDefault();
            focusGameQuantity();
          }}
          aria-invalid={Boolean(pickError)}
          aria-describedby={pickError ? "pick-error" : undefined}
        />
        {pickError && (
          <p id="pick-error" className="status" role="alert">
            {pickError}
          </p>
        )}
      </div>
      {lottery === "mais-milionaria" && (
        <div className="section">
          <h3>🍀 Trevos da +Milionária</h3>
          <p className="muted">
            Escolha os trevos de 01 a 06. Na aposta simples são 2 trevos. Se não
            marcar, o sistema escolhe automaticamente.
          </p>
          <div className="field">
            <label>
              Trevos por jogo <small className="muted">(mín. 2 · máx. 6)</small>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="2"
              max="6"
              value={trevoPick}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const n = Math.max(
                  2,
                  Math.min(6, Math.trunc(Number(e.target.value) || 2)),
                );
                setTrevoPick(n);
                setManualTrevos((v) => v.slice(0, n));
                setGames([]);
                resetFeedback();
              }}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: "12px",
              maxWidth: "360px",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const selected = manualTrevos.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleTrevo(n)}
                  aria-pressed={selected}
                  style={{
                    fontSize: "30px",
                    minHeight: "76px",
                    border: "0",
                    background: "transparent",
                    cursor: "pointer",
                    filter: selected
                      ? "drop-shadow(0 0 10px #f7c948)"
                      : "drop-shadow(0 2px 3px #000)",
                  }}
                >
                  <span
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "64px",
                      height: "64px",
                      fontSize: "62px",
                      lineHeight: 1,
                      color: selected ? "#f7c948" : "#45d66b",
                      textShadow: selected
                        ? "0 0 10px rgba(247,201,72,.8)"
                        : "0 0 7px rgba(69,214,107,.45)",
                    }}
                  >
                    🍀
                    <b
                      style={{
                        position: "absolute",
                        fontSize: "15px",
                        color: "#ffd84d",
                        textShadow: selected
                          ? "0 0 7px rgba(255,216,77,.95), 0 1px 3px #000"
                          : "0 1px 3px #000",
                      }}
                    >
                      {String(n).padStart(2, "0")}
                    </b>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="muted">
            Trevos selecionados: {manualTrevos.length}/{trevoPick}
          </p>
        </div>
      )}
      <div className="field">
        <label>
          Quantidade de jogos automáticos{" "}
          <small className="muted">(máx. 1000)</small>
        </label>
        <input
          id="game-quantity-input"
          type="number"
          inputMode="numeric"
          enterKeyHint="done"
          min="1"
          max="1000"
          value={qtyInput}
          placeholder="Digite a quantidade"
          onChange={(e) => {
            setQtyInput(e.target.value);
            const n = Number(e.target.value);
            if (
              e.target.value !== "" &&
              Number.isInteger(n) &&
              n >= 1 &&
              n <= 1000
            )
              setQty(n);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            advanceToNumberSelection(e.currentTarget);
          }}
          aria-invalid={Boolean(qtyError)}
          aria-describedby={qtyError ? "qty-error" : undefined}
        />
        {qtyError && (
          <p id="qty-error" className="status" role="alert">
            {qtyError}
          </p>
        )}
      </div>
      {lottery !== "super-sete" && (
        <div className="section">
          <h3>🚫 Números que NÃO quero nos jogos</h3>
          <p className="muted">
            Opcional. Escolha até {exclusionLimit} ímpares e até{" "}
            {exclusionLimit} pares. Os selecionados ficam fora de todos os
            jogos.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <strong>
                1 - ÍMPAR ({excludedOdd.length}/{exclusionLimit})
              </strong>
              <div
                className="number-grid"
                style={{
                  gridTemplateColumns: "repeat(3,1fr)",
                  marginTop: "10px",
                }}
              >
                {oddNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`number-button ${excludedOdd.includes(n) ? "selected" : ""}`}
                    onClick={() => toggleExclude(n, true)}
                  >
                    {String(n).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <strong>
                2 - PAR ({excludedEven.length}/{exclusionLimit})
              </strong>
              <div
                className="number-grid"
                style={{
                  gridTemplateColumns: "repeat(3,1fr)",
                  marginTop: "10px",
                }}
              >
                {evenNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`number-button ${excludedEven.includes(n) ? "selected" : ""}`}
                    onClick={() => toggleExclude(n, false)}
                  >
                    {String(n).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="section">
        <h3>🔢 Números primos que NÃO quero nos jogos</h3>
        <p className="muted">
          Opcional e sem limite. Marque os números primos que devem ficar fora
          {lottery === "super-sete" ? " de todas as colunas" : " de todos os jogos"}.
        </p>
        <div className="number-grid">
          {primeNumbers.map((n) => (
            <button
              key={n}
              type="button"
              className={`number-button ${excludedPrimes.includes(n) ? "selected" : ""}`}
              onClick={() => togglePrimeExclude(n)}
              aria-pressed={excludedPrimes.includes(n)}
            >
              {String(n).padStart(2, "0")}
            </button>
          ))}
        </div>
        <p className="muted">
          Primos excluídos: {excludedPrimes.length}
        </p>
      </div>
      {exclusionError && (
        <p className="status" role="alert" style={{ color: "#facc15" }}>
          ⚠️ {exclusionError}
        </p>
      )}
      <div className="actions">
        <button
          className="button primary"
          type="button"
          onClick={auto}
          disabled={!canGenerate}
        >
          🎲 Gerar fechamento
        </button>
        {lottery !== "super-sete" && (
          <button
            className="button secondary"
            type="button"
            onClick={manualGames}
            disabled={manual.length !== pick}
          >
            Usar meus números
          </button>
        )}
      </div>
      {lottery !== "super-sete" && (
        <div id="manual-number-selection" style={{ scrollMarginTop: "150px" }}>
          <p className="muted">Escolha manualmente {pick} números:</p>
          <div className="number-grid">
            {available.map((n) => (
              <button
                key={n}
                type="button"
                className={`number-button ${manual.includes(n) ? "selected" : ""}`}
                onClick={() => toggle(n)}
              >
                {String(n).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="muted">
        Base do fechamento: últimos {Math.min(50, results.length)} resultados
        salvos · números quentes · frios · atrasados · Fibonacci · primos. Os números
        excluídos nunca entram nos jogos gerados.
      </p>
      {visibleGames.length > 0 && (
        <div
          className="section"
          id="generated-games"
          style={{ scrollMarginTop: "150px" }}
        >
          <h2>Seus jogos</h2>
          <div className="list">
            {visibleGames.map((g, i) => (
              <div className="list-item" key={i}>
                <strong>Jogo {i + 1}</strong>
                <span>
                  {g.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")}
                  {lottery === "mais-milionaria" && (
                    <>
                      {" "}
                      <b>🍀 Trevos:</b>{" "}
                      {g.trevos
                        .map((n) => String(n).padStart(2, "0"))
                        .join(" · ")}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
          {games.length > 0 && (
            <>
              <div className="actions" style={{ marginTop: "16px" }}>
                <button
                  className="button primary"
                  type="button"
                  onClick={saveGames}
                >
                  {saved ? "✅ JOGO SALVO" : "💾 SALVAR JOGO"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={shareGames}
                >
                  {shared ? "✅ PRONTO" : "📲 COMPARTILHAR JOGO"}
                </button>
              </div>
              <p className="muted" style={{ fontSize: "12px" }}>
                Salvar guarda os jogos neste aparelho. Compartilhar abre o menu do
                celular para enviar pelo WhatsApp ou outro aplicativo.
              </p>
            </>
          )}
        </div>
      )}
      {showSaveDialog && (
        <div
          className="reservation-confirmed-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-game-dialog-title"
        >
          <div className="reservation-confirmed-card">
            <div className="reservation-confirmed-icon" aria-hidden="true">
              ✓
            </div>
            <h2 id="save-game-dialog-title">Jogo salvo!</h2>
            <p>Você deseja criar outro jogo?</p>
            <div className="save-game-dialog-actions">
              <button
                className="button primary"
                type="button"
                onClick={createAnotherGame}
              >
                Sim
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => window.location.assign(returnHref)}
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
