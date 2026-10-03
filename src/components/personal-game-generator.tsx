"use client";
import { useMemo, useRef, useState } from "react";
import { uniqueLotofacil } from "@/lib/unique-lotofacil";
import { GameListWindow } from "@/components/game-list-window";
import { GameListScrollbar } from "@/components/game-list-scrollbar";
import { officialGamesCostCents } from "@/lib/lottery-pricing";
import { formatGameReference, withStableGameReferences } from "@/lib/game-reference";
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
const combinationCountUpTo = (total: number, pick: number, limit: number) => {
  if (pick < 0 || pick > total) return 0;
  const size = Math.min(pick, total - pick);
  let result = 1;
  for (let index = 1; index <= size; index++) {
    result = (result * (total - size + index)) / index;
    if (result > limit) return limit + 1;
  }
  return Math.round(result);
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
  const savingLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [savePhase, setSavePhase] = useState("");
  const [sharing, setSharing] = useState(false);
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
    [showSaveDialog, setShowSaveDialog] = useState(false),
    [generating, setGenerating] = useState(false),
    [generationProgress, setGenerationProgress] = useState(0),
    [generationRequested, setGenerationRequested] = useState(0);
  const allNumbers = useMemo(
    () => Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i),
    [r.min, r.max],
  );
  const oddNumbers = useMemo(
    () => allNumbers.filter((n) => n % 2 !== 0 && !excludedPrimes.includes(n)),
    [allNumbers, excludedPrimes],
  );
  const evenNumbers = useMemo(
    () => allNumbers.filter((n) => n % 2 === 0 && !excludedPrimes.includes(n)),
    [allNumbers, excludedPrimes],
  );
  const exclusionLimit = Math.max(1, Math.floor((r.max - r.min + 1) / 4));
  const visibleGames = useMemo(() => [...savedGamesOnPage, ...games], [savedGamesOnPage, games]);
  const gameRows = useMemo(() => visibleGames.map((g, i) => (
              <div className="list-item" key={i} data-game-reference={i + 1} style={{ height: "100%", overflow: "auto" }}>
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
                <small className="muted">{formatGameReference(i + 1)}</small>
              </div>
            )), [visibleGames, lottery]);
  const excluded = new Set([...excludedOdd, ...excludedEven, ...excludedPrimes]);
  const available = allNumbers.filter((n) => !excluded.has(n));
  const fibSet = useMemo(() => fibonacciUpTo(r.max), [r.max]);
  const primeSet = useMemo(() => primesUpTo(r.max), [r.max]);
  const primeNumbers = useMemo(
    () =>
      allNumbers.filter(
        (n) =>
          primeSet.has(n) &&
          !excludedOdd.includes(n) &&
          !excludedEven.includes(n),
      ),
    [allNumbers, primeSet, excludedOdd, excludedEven],
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
      enteredQty <= 5000,
    qtyError =
      qtyInput === ""
        ? ""
        : enteredQty < 1
          ? "A quantidade mínima é 1 jogo."
          : enteredQty > 5000
            ? "A quantidade máxima é 5.000 jogos."
            : !Number.isInteger(enteredQty)
              ? "Digite somente um número inteiro."
              : "";
  const canGenerate =
    pickIsValid &&
    qtyIsValid &&
    (lottery === "super-sete" || available.length >= pick);
  const resetFeedback = () => {
    setSaveProgress(0);
    setSavePhase("");
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
    if (!canGenerate || generating) return;
    setGenerating(true);
    setGenerationProgress(0);
    setGenerationRequested(qty);
    setGames([]);
    resetFeedback();

    const wanted = Math.max(1, Math.min(5000, qty));
    const possible = combinationCountUpTo(available.length, pick, wanted);
    const target = Math.min(wanted, possible);
    const out: Game[] = [];
    const seen = new Set<string>();
    const preferred = oneNumbers();
    const lotofacilSequence = lottery === "lotofacil"
      ? uniqueLotofacil([...preferred, ...shuffle(available.filter(n => !preferred.includes(n)))], pick, wanted)
      : null;
    let attempts = 0;
    const maxAttempts = Math.max(1000, target * 500);
    let lastProgressAt = 0;

    const runBatch = () => {
      const deadline = performance.now() + 8;
      while (out.length < target && attempts < maxAttempts && performance.now() < deadline) {
        attempts++;
        const game = {
          numbers: lotofacilSequence ? lotofacilSequence.next()! : oneNumbers(),
          trevos: oneTrevos(),
        };
        const key = `${game.numbers.join("-")}|${game.trevos.join("-")}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(game);

        }
      }

      const now = performance.now();
      if (now - lastProgressAt >= 100 || out.length >= target) {
        setGenerationProgress(out.length);
        lastProgressAt = now;
      }
      if (out.length < target && attempts < maxAttempts) {
        window.setTimeout(runBatch, 16);
        return;
      }

      setGenerationProgress(out.length);
      setGames(out);
      setExclusionError(
        possible < wanted
          ? `Com as dezenas disponíveis existem somente ${possible} jogos diferentes de ${pick} dezenas. O app gerou todas as combinações possíveis.`
          : out.length < target
            ? `O fechamento não conseguiu completar ${target.toLocaleString("pt-BR")} jogos diferentes. Foram gerados ${out.length.toLocaleString("pt-BR")}. Tente gerar novamente.`
            : "",
      );
      setGenerating(false);
      showGenerated();
    };

    window.setTimeout(runBatch, 30);
  };
  const buildManualGames = (numbers: number[]) => {
    if (numbers.length !== pick || numbers.some((n) => excluded.has(n))) return;
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
    if (excluded.has(n)) return;
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
    if (current.length >= exclusionLimit) {
      setExclusionError(`Escolha no máximo ${exclusionLimit} dezenas deste grupo.`);
      return;
    }
    if (!excluded.has(n) && available.length - 1 < pick) {
      setExclusionError(
        "Não sobraram dezenas suficientes. Desmarque algum número para criar o jogo.",
      );
      return;
    }
    setExcludedPrimes((values) => values.filter((x) => x !== n));
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
    setExcludedOdd((current) => current.filter((x) => x !== n));
    setExcludedEven((current) => current.filter((x) => x !== n));
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
  const referencedGames = () => withStableGameReferences(games);
  const gameText = (game: Game & { referenceNumber?: number }, i: number) => {
    const referenceNumber = game.referenceNumber ?? i + 1;
    return `Jogo ${referenceNumber}: ${game.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")}${lottery === "mais-milionaria" ? ` | Trevos: ${game.trevos.map((n) => String(n).padStart(2, "0")).join(" · ")}` : ""}`;
  };
  const saveGames = async () => {
    if (savingLock.current || saved || sharing) return;
    savingLock.current = true;
    setSaving(true);
    setSaveProgress(0);
    setSavePhase("Preparando jogos");
    try {
      await new Promise(resolve => setTimeout(resolve, 40));
      if (!games.length || games.some(game => game.numbers.some(number => excluded.has(number))))
        throw new Error("Verifique os jogos e os números excluídos antes de salvar.");
      const prepared: Array<Game & { referenceNumber: number }> = [];
      const chunks: string[] = [];
      for (let offset = 0; offset < games.length; offset += 100) {
        const chunk = games.slice(offset, offset + 100).map((game, index) => ({ ...game, referenceNumber: offset + index + 1 }));
        prepared.push(...chunk);
        chunks.push(JSON.stringify(chunk).slice(1, -1));
        setSaveProgress(Math.round(prepared.length / games.length * 15));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const fields = JSON.stringify({ lottery, ...(participantToken ? { token: participantToken, contest: latestContest ? latestContest + 1 : null } : {}) });
      const body = `${fields.slice(0, -1)},"games":[${chunks.join(",")}]}`;
      setSavePhase("Enviando jogos");
      const data = await new Promise<{ id?: string; contest?: number; savedCount?: number; duplicateCount?: number; allDuplicates?: boolean }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", participantToken ? "/api/personal-games" : "/api/organizer-personal-games");
        request.setRequestHeader("Content-Type", "application/json");
        request.timeout = 60000;
        request.upload.onprogress = event => {
          if (event.lengthComputable) setSaveProgress(15 + Math.round(event.loaded / event.total * 80));
        };
        request.upload.onload = () => { setSaveProgress(95); setSavePhase("Confirmando salvamento"); };
        request.onerror = () => reject(new Error("Falha na conexão. Seus jogos continuam nesta tela."));
        request.ontimeout = () => reject(new Error("A confirmação demorou demais. Confira Meus jogos salvos antes de tentar novamente."));
        request.onload = () => {
          try {
            const result = JSON.parse(request.responseText);
            if (request.status < 200 || request.status >= 300) throw new Error(result.error || "Não foi possível salvar os jogos.");
            resolve(result);
          } catch (error) { reject(error); }
        };
        request.send(body);
      });
      if (data.allDuplicates) {
        setSaveProgress(100);
        setSavePhase("Todos estes jogos já estão salvos");
        setSaved(true);
        alert("Todos estes jogos já estão salvos neste cartão. Nenhum repetido foi adicionado.");
        return;
      }
      if (!data.id || !data.contest) throw new Error("O servidor não confirmou o registro. Confira Meus jogos salvos.");
      // The server is authoritative. Local cache failure must not undo a confirmed save.
      if (!data.duplicateCount) {
        const entry = { participantToken, id: data.id, lottery, label: r.label, games: prepared,
          targetContest: data.contest, totalCostCents: officialGamesCostCents(lottery, prepared), createdAt: new Date().toISOString() };
        try {
          const key = participantToken ? `bolao-amigos-btp:jogos-salvos:${participantToken}` : "bolao-amigos-btp:jogos-salvos";
          const previous = JSON.parse(localStorage.getItem(key) || "[]");
          localStorage.setItem(key, JSON.stringify([entry, ...(Array.isArray(previous) ? previous.filter(item => item.id !== data.id) : [])]));
        } catch { /* Load the confirmed record from the server when opening saved games. */ }
      }
      setSaveProgress(100);
      setSavePhase(`${(data.savedCount ?? prepared.length).toLocaleString("pt-BR")} jogos salvos${data.duplicateCount ? `; ${data.duplicateCount} repetidos não adicionados` : ""}`);
      setSaved(true);
      setShowSaveDialog(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar. Seus jogos continuam nesta tela.";
      setSavePhase(message);
      alert(message);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };
  const createAnotherGame = () => {
    setSaveProgress(0);
    setSavePhase("");
    setSavedGamesOnPage((current) => [...current, ...games]);
    setGames([]);
    setManual([]);
    setManualTrevos([]);
    setSaved(false);
    setShowSaveDialog(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const shareGames = async () => {
    if (sharing || saving) return;
    setSharing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 40));
      const lines: string[] = [];
      for (let offset = 0; offset < visibleGames.length; offset += 100) {
        visibleGames.slice(offset, offset + 100).forEach((game, index) => {
          const reference = offset + index + 1;
          lines.push(`${gameText(game, reference - 1)} | ${formatGameReference(reference)}`);
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const { shareGamesPdf } = await import("@/lib/game-pdf");
      await shareGamesPdf(r.label, lines);
      setShared(true);
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") alert("Não foi possível preparar o PDF. Seus jogos continuam nesta tela.");
    } finally { setSharing(false); }
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
          <small className="muted">(máx. 5.000)</small>
        </label>
        <input
          id="game-quantity-input"
          type="number"
          inputMode="numeric"
          enterKeyHint="done"
          min="1"
          max="5000"
          value={qtyInput}
          placeholder="Digite a quantidade"
          onChange={(e) => {
            setQtyInput(e.target.value);
            const n = Number(e.target.value);
            if (
              e.target.value !== "" &&
              Number.isInteger(n) &&
              n >= 1 &&
              n <= 5000
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
          disabled={!canGenerate || generating}
        >
          {generating ? `⏳ CRIANDO JOGOS ${generationProgress.toLocaleString("pt-BR")} / ${Math.min(qty, 5000).toLocaleString("pt-BR")}` : "🎲 Gerar fechamento"}
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
      <div
        role="progressbar"
        aria-label="Progresso da geração dos jogos"
        aria-valuemin={0}
        aria-valuemax={generationRequested || qty}
        aria-valuenow={generationProgress}
        style={{
          height: "3px",
          borderRadius: "999px",
          overflow: "hidden",
          background: "rgba(255,255,255,.14)",
          marginTop: "8px",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${generationRequested > 0 ? Math.min(100, (generationProgress / generationRequested) * 100) : 0}%`,
            background: "#00FFD5",
            transition: "width .2s ease",
          }}
        />
      </div>
      {generationRequested > 0 && (
        <small className="muted">
          {generationProgress.toLocaleString("pt-BR")} de {generationRequested.toLocaleString("pt-BR")} jogos · {Math.floor(generationProgress / generationRequested * 100)}%
        </small>
      )}
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
          <GameListScrollbar count={visibleGames.length} />
          <GameListWindow listId="generated-game-list" rows={gameRows} />
          {games.length > 0 && (
            <>
              {savePhase && <p className="status" role="status" aria-live="polite">{savePhase}{saving ? ` · ${saveProgress}%` : ""}</p>}
              <div className="actions" style={{ marginTop: "16px" }}>
                <button
                  className="button primary"
                  type="button"
                  onClick={saveGames}
                  style={{ position: "relative", overflow: "hidden", paddingBottom: "19px" }}
                  disabled={saving || saved || sharing}
                  aria-busy={saving}
                >
                  {saving ? `⏳ SALVANDO · ${saveProgress}%` : saved ? "✅ JOGOS SALVOS" : "💾 SALVAR JOGO"}
                  {(saving || saved) && <span role="progressbar" aria-label="Progresso do salvamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={saveProgress} style={{ position: "absolute", bottom: 3, left: 0, right: 0, height: 3, background: "#0003" }}><span style={{ display: "block", height: "100%", width: `${saveProgress}%`, background: "#00ffd5", transition: "width .15s linear" }} /></span>}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={shareGames}
                  data-share-games="memory"
                  disabled={sharing || saving}
                  aria-busy={sharing}
                >
                  {sharing ? "⏳ PREPARANDO PDF..." : shared ? "✅ PRONTO" : "📲 COMPARTILHAR JOGO"}
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
