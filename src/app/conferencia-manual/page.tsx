"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { officialGamesCostCents } from "@/lib/lottery-pricing";

type Game = { numbers: number[]; trevos?: number[] };
type Saved = {
  id: string;
  lottery: string;
  label: string;
  games: Game[];
  createdAt: string;
  targetContest?: number | null;
  totalCostCents?: number;
};
type CheckedGame = {
  id: string;
  savedLabel: string;
  gameIndex: number;
  numbers: number[];
  trevos?: number[];
  hits: number;
  matched: number[];
  drawIndex: number;
  trevoHits: number;
};
type ManualCheck = {
  lottery: string;
  label: string;
  contest: number;
  sourceContest: number;
  games: CheckedGame[];
  totalCostCents: number;
  drawNumbers: number[];
  secondDrawNumbers: number[];
  drawTrevos: number[];
};
type StoredManual = {
  lottery: string;
  savedContest: string;
  resultContest: string;
  numbersInput: string;
  secondDrawInput: string;
  trevosInput: string;
  receivedInput: string;
  checked: ManualCheck;
  savedAt: string;
};
type DrawRule = { count: number; min: number; max: number; repeat?: boolean };

const KEY = "bolao-amigos-btp:jogos-salvos";
const MANUAL_KEY = "bolao-amigos-btp:conferencias-manuais";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const drawRules: Record<string, DrawRule> = {
  "mega-sena": { count: 6, min: 1, max: 60 },
  lotofacil: { count: 15, min: 1, max: 25 },
  quina: { count: 5, min: 1, max: 80 },
  "dupla-sena": { count: 6, min: 1, max: 50 },
  lotomania: { count: 20, min: 0, max: 99 },
  timemania: { count: 7, min: 1, max: 80 },
  "dia-de-sorte": { count: 7, min: 1, max: 31 },
  "super-sete": { count: 7, min: 0, max: 9, repeat: true },
  "mais-milionaria": { count: 6, min: 1, max: 50 },
};

function parseNumbers(raw: string) {
  return (raw.match(/\d+/g) ?? []).map(Number);
}

function validateDraw(lottery: string, numbers: number[], label: string) {
  const rule = drawRules[lottery];
  if (!rule) return "Modalidade não reconhecida.";
  if (numbers.length !== rule.count)
    return `${label}: encontrei ${numbers.length} número(s). Informe exatamente ${rule.count}.`;
  if (numbers.some((number) => !Number.isInteger(number) || number < rule.min || number > rule.max))
    return `${label}: use somente números de ${String(rule.min).padStart(2, "0")} a ${String(rule.max).padStart(2, "0")}.`;
  if (!rule.repeat && new Set(numbers).size !== numbers.length)
    return `${label}: existem números repetidos.`;
  return "";
}

function compareGame(lottery: string, game: Game, draws: number[][], drawTrevos: number[]) {
  const trevoHits =
    lottery === "mais-milionaria"
      ? (game.trevos ?? []).filter((number) => drawTrevos.includes(Number(number))).length
      : 0;

  const checks = draws.map((numbers, index) => {
    if (lottery === "super-sete") {
      const matched = game.numbers.filter(
        (number, numberIndex) => Number(numbers[numberIndex]) === Number(number),
      );
      return { hits: matched.length, matched, drawIndex: index + 1 };
    }
    const drawn = new Set(numbers.map(Number));
    const matched = game.numbers.filter((number) => drawn.has(Number(number)));
    return { hits: matched.length, matched, drawIndex: index + 1 };
  });

  return checks.reduce((best, current) =>
    current.hits > best.hits ? current : best,
  );
}

function savedItemCost(item: Saved) {
  if (Number.isFinite(item.totalCostCents) && Number(item.totalCostCents) >= 0)
    return Number(item.totalCostCents);
  try {
    return officialGamesCostCents(item.lottery, item.games);
  } catch {
    return 0;
  }
}

function parseMoneyToCents(raw: string) {
  const compact = raw.trim().replace(/\s/g, "");
  if (!compact) return null;
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const value = Number(normalized.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function storeManual(record: StoredManual) {
  try {
    const current = JSON.parse(localStorage.getItem(MANUAL_KEY) || "[]");
    const history = Array.isArray(current) ? (current as StoredManual[]) : [];
    const next = [
      record,
      ...history.filter(
        (item) =>
          !(item.lottery === record.lottery && item.resultContest === record.resultContest),
      ),
    ].slice(0, 30);
    localStorage.setItem(MANUAL_KEY, JSON.stringify(next));
  } catch {}
}

export default function ManualConferencePage() {
  const [items, setItems] = useState<Saved[]>([]);
  const [lottery, setLottery] = useState("");
  const [savedContest, setSavedContest] = useState("");
  const [resultContest, setResultContest] = useState("");
  const [numbersInput, setNumbersInput] = useState("");
  const [secondDrawInput, setSecondDrawInput] = useState("");
  const [trevosInput, setTrevosInput] = useState("");
  const [receivedInput, setReceivedInput] = useState("");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<ManualCheck | null>(null);
  const [publishState, setPublishState] = useState<"idle" | "saving" | "saved" | "local-only">("idle");

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
      const saved = Array.isArray(parsed) ? (parsed as Saved[]) : [];
      setItems(saved);

      const manualParsed = JSON.parse(localStorage.getItem(MANUAL_KEY) || "[]");
      const history = Array.isArray(manualParsed) ? (manualParsed as StoredManual[]) : [];
      const latest = history[0];
      if (latest?.checked) {
        setLottery(latest.lottery);
        setSavedContest(latest.savedContest);
        setResultContest(latest.resultContest);
        setNumbersInput(latest.numbersInput);
        setSecondDrawInput(latest.secondDrawInput);
        setTrevosInput(latest.trevosInput);
        setReceivedInput(latest.receivedInput);
        setChecked(latest.checked);
        setPublishState("saved");
        return;
      }

      const first = saved.find((item) => Number(item.targetContest) > 0) ?? saved[0];
      if (first) {
        setLottery(first.lottery);
        if (Number(first.targetContest) > 0) {
          const contest = String(first.targetContest);
          setSavedContest(contest);
          setResultContest(contest);
        }
      }
    } catch {
      setItems([]);
    }
  }, []);

  const lotteries = useMemo(
    () => Array.from(new Map(items.map((item) => [item.lottery, item.label])).entries()),
    [items],
  );

  const savedContests = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((item) => item.lottery === lottery)
            .map((item) => Number(item.targetContest))
            .filter((contest) => Number.isInteger(contest) && contest > 0),
        ),
      ).sort((a, b) => b - a),
    [items, lottery],
  );

  const matchingItems = useMemo(() => {
    const contest = Number(savedContest);
    return items.filter(
      (item) => item.lottery === lottery && Number(item.targetContest) === contest,
    );
  }, [items, lottery, savedContest]);

  const gameCount = matchingItems.reduce((sum, item) => sum + item.games.length, 0);

  const resetResult = () => {
    setNumbersInput("");
    setSecondDrawInput("");
    setTrevosInput("");
    setReceivedInput("");
    setChecked(null);
    setError("");
    setPublishState("idle");
  };

  const selectLottery = (value: string) => {
    setLottery(value);
    const contests = items
      .filter((item) => item.lottery === value)
      .map((item) => Number(item.targetContest))
      .filter((contest) => Number.isInteger(contest) && contest > 0)
      .sort((a, b) => b - a);
    const nextContest = contests[0] ? String(contests[0]) : "";
    setSavedContest(nextContest);
    setResultContest(nextContest);
    resetResult();
  };

  const selectSavedContest = (value: string) => {
    setSavedContest(value);
    setResultContest(value);
    resetResult();
  };

  const runCheck = async () => {
    setError("");
    setChecked(null);
    setPublishState("saving");

    const sourceContest = Number(savedContest);
    const contest = Number(resultContest);
    if (!Number.isInteger(sourceContest) || sourceContest <= 0 || !matchingItems.length) {
      setError("Selecione primeiro um concurso que exista nos Jogos Salvos.");
      setPublishState("idle");
      return;
    }
    if (!Number.isInteger(contest) || contest <= 0) {
      setError("Informe o número real do concurso do resultado.");
      setPublishState("idle");
      return;
    }

    const drawNumbers = parseNumbers(numbersInput);
    const firstError = validateDraw(lottery, drawNumbers, "Resultado");
    if (firstError) {
      setError(firstError);
      setPublishState("idle");
      return;
    }

    let secondDrawNumbers: number[] = [];
    if (lottery === "dupla-sena" && secondDrawInput.trim()) {
      secondDrawNumbers = parseNumbers(secondDrawInput);
      const secondError = validateDraw(lottery, secondDrawNumbers, "2º sorteio");
      if (secondError) {
        setError(secondError);
        setPublishState("idle");
        return;
      }
    }

    let drawTrevos: number[] = [];
    if (lottery === "mais-milionaria") {
      drawTrevos = parseNumbers(trevosInput);
      if (
        drawTrevos.length !== 2 ||
        drawTrevos.some((number) => !Number.isInteger(number) || number < 1 || number > 6) ||
        new Set(drawTrevos).size !== drawTrevos.length
      ) {
        setError("Informe os 2 trevos sorteados, de 01 a 06, sem repetir.");
        setPublishState("idle");
        return;
      }
    }

    const draws = secondDrawNumbers.length ? [drawNumbers, secondDrawNumbers] : [drawNumbers];
    const games: CheckedGame[] = [];
    let totalCostCents = 0;

    for (const item of matchingItems) {
      totalCostCents += savedItemCost(item);
      item.games.forEach((game, index) => {
        const result = compareGame(lottery, game, draws, drawTrevos);
        games.push({
          id: `${item.id}-${index}`,
          savedLabel: item.label,
          gameIndex: index + 1,
          numbers: game.numbers,
          trevos: game.trevos,
          hits: result.hits,
          matched: result.matched,
          drawIndex: result.drawIndex,
          trevoHits: result.trevoHits,
        });
      });
    }

    const label = lotteries.find(([id]) => id === lottery)?.[1] ?? lottery;
    const result: ManualCheck = {
      lottery,
      label,
      contest,
      sourceContest,
      games,
      totalCostCents,
      drawNumbers,
      secondDrawNumbers,
      drawTrevos,
    };
    setChecked(result);

    storeManual({
      lottery,
      savedContest,
      resultContest,
      numbersInput,
      secondDrawInput,
      trevosInput,
      receivedInput,
      checked: result,
      savedAt: new Date().toISOString(),
    });

    try {
      const response = await fetch("/api/manual-lottery-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lottery,
          contest,
          numbers: drawNumbers,
          secondDrawNumbers,
          trevos: drawTrevos,
        }),
      });
      if (!response.ok) throw new Error("não publicado");
      setPublishState("saved");
    } catch {
      setPublishState("local-only");
    }
  };

  const distribution = useMemo(() => {
    if (!checked) return [];
    const counts = new Map<string, { hits: number; trevoHits: number; count: number }>();
    for (const game of checked.games) {
      const key = checked.lottery === "mais-milionaria" ? `${game.hits}+${game.trevoHits}` : String(game.hits);
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { hits: game.hits, trevoHits: game.trevoHits, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.hits - a.hits || b.trevoHits - a.trevoHits);
  }, [checked]);

  const receivedCents = parseMoneyToCents(receivedInput);
  const balanceCents = checked && receivedCents != null ? receivedCents - checked.totalCostCents : null;

  const updateReceived = (value: string) => {
    setReceivedInput(value);
    if (!checked) return;
    storeManual({
      lottery,
      savedContest,
      resultContest,
      numbersInput,
      secondDrawInput,
      trevosInput,
      receivedInput: value,
      checked,
      savedAt: new Date().toISOString(),
    });
  };

  return (
    <main className="shell">
      <Link className="back" href="/jogos-salvos">← Voltar</Link>

      <section className="section">
        <p className="eyebrow">JOGOS SALVOS</p>
        <h1>Conferir resultado manual</h1>
        <p className="muted">
          Escolha os jogos já salvos, informe o concurso real e cole as dezenas sorteadas. O resultado fica registrado e pode ser usado pelos participantes sem alterar o widget da CAIXA.
        </p>
      </section>

      {items.length === 0 ? (
        <section className="section">
          <p>Nenhum jogo salvo neste aparelho.</p>
          <Link className="button primary" href="/meu-jogo">Criar um jogo</Link>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="field">
              <label>Modalidade</label>
              <select value={lottery} onChange={(event) => selectLottery(event.target.value)}>
                {lotteries.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Jogos salvos do concurso</label>
              {savedContests.length ? (
                <select value={savedContest} onChange={(event) => selectSavedContest(event.target.value)}>
                  {savedContests.map((contest) => (
                    <option key={contest} value={contest}>Concurso {contest}</option>
                  ))}
                </select>
              ) : (
                <div className="status">Não há concurso identificado nos jogos salvos desta modalidade.</div>
              )}
              <small className="muted">Este campo escolhe quais jogos do seu histórico serão conferidos.</small>
            </div>

            <div className="field">
              <label>Concurso do resultado</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={resultContest}
                onChange={(event) => {
                  setResultContest(event.target.value);
                  setChecked(null);
                  setError("");
                  setPublishState("idle");
                }}
                placeholder="Ex.: 3780"
              />
              {savedContest && resultContest && savedContest !== resultContest && (
                <small className="muted">
                  Os jogos foram gravados como concurso {savedContest}, mas serão conferidos com o resultado do concurso {resultContest}.
                </small>
              )}
            </div>

            <div className="field">
              <label>Dezenas sorteadas</label>
              <textarea
                value={numbersInput}
                onChange={(event) => setNumbersInput(event.target.value)}
                rows={3}
                placeholder="Ex.: 01 02 03 04 05 06 ..."
              />
              <small className="muted">Pode colar com espaços, vírgulas, pontos ou hífens.</small>
            </div>

            {lottery === "dupla-sena" && (
              <div className="field">
                <label>Dezenas do 2º sorteio</label>
                <textarea
                  value={secondDrawInput}
                  onChange={(event) => setSecondDrawInput(event.target.value)}
                  rows={2}
                  placeholder="Opcional: informe o 2º sorteio para conferir os dois."
                />
              </div>
            )}

            {lottery === "mais-milionaria" && (
              <div className="field">
                <label>Trevos sorteados</label>
                <input
                  value={trevosInput}
                  onChange={(event) => setTrevosInput(event.target.value)}
                  inputMode="numeric"
                  placeholder="Ex.: 02 05"
                />
              </div>
            )}

            <div className="status">Jogos encontrados para esta seleção: {gameCount}</div>
            {error && <p className="status" role="alert" style={{ color: "#facc15" }}>{error}</p>}

            <button className="button primary" type="button" onClick={runCheck} disabled={publishState === "saving"}>
              {publishState === "saving" ? "CONFERINDO E SALVANDO..." : "CONFERIR E SALVAR RESULTADO"}
            </button>

            {publishState === "saved" && (
              <p className="status">✓ Resultado salvo. Ao voltar para esta tela ele continuará registrado e os participantes podem usá-lo em “Conferir meus jogos”.</p>
            )}
            {publishState === "local-only" && (
              <p className="status" style={{ color: "#facc15" }}>
                A conferência ficou salva neste aparelho, mas ainda não foi publicada para os participantes.
              </p>
            )}
          </section>

          {checked && (
            <>
              <section className="section">
                <p className="eyebrow">CONCURSO {checked.contest}</p>
                <h2>{checked.label} — resumo</h2>
                <div className="performance-totals">
                  <div><span>Jogos conferidos</span><strong>{checked.games.length}</strong></div>
                  <div><span>Total apostado</span><strong>{money.format(checked.totalCostCents / 100)}</strong></div>
                  <div><span>Maior acerto</span><strong>{Math.max(0, ...checked.games.map((game) => game.hits))}</strong></div>
                </div>

                <div className="list" style={{ marginTop: 16 }}>
                  {distribution.map((row) => (
                    <div className="list-item" key={`${row.hits}-${row.trevoHits}`}>
                      <strong>{row.hits} acertos{checked.lottery === "mais-milionaria" ? ` + ${row.trevoHits} trevo(s)` : ""}</strong>
                      <span>{row.count} jogo{row.count === 1 ? "" : "s"}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="section">
                <h2>Lucro ou prejuízo</h2>
                <p className="muted">
                  Informe quanto esses jogos receberam em prêmios no total. Se não houve prêmio, informe 0.
                </p>
                <div className="field">
                  <label>Total recebido em prêmios (R$)</label>
                  <input
                    value={receivedInput}
                    onChange={(event) => updateReceived(event.target.value)}
                    inputMode="decimal"
                    placeholder="Ex.: 0,00"
                  />
                </div>

                {receivedInput.trim() !== "" && receivedCents == null && (
                  <p className="status" role="alert" style={{ color: "#facc15" }}>Informe um valor de prêmio válido.</p>
                )}

                {balanceCents != null && receivedCents != null && (
                  <div className="performance-totals">
                    <div><span>Total apostado</span><strong>{money.format(checked.totalCostCents / 100)}</strong></div>
                    <div><span>Total recebido</span><strong>{money.format(receivedCents / 100)}</strong></div>
                    <div>
                      <span>{balanceCents >= 0 ? "Lucro" : "Prejuízo"}</span>
                      <strong className={balanceCents >= 0 ? "performance-positive" : "performance-negative"}>
                        {money.format(Math.abs(balanceCents) / 100)}
                      </strong>
                    </div>
                  </div>
                )}
              </section>

              <section className="section">
                <h2>Acertos por jogo</h2>
                <div className="list">
                  {checked.games.map((game) => {
                    const matched = new Set(game.matched.map(Number));
                    return (
                      <div className="list-item" key={game.id}>
                        <div>
                          <strong>{game.savedLabel} · Jogo {game.gameIndex}</strong>
                          <div className="muted">
                            {game.numbers.map((number, index) => (
                              <b
                                key={index}
                                style={{
                                  color: matched.has(Number(number)) ? "#55f27a" : "inherit",
                                  textShadow: matched.has(Number(number)) ? "0 0 8px rgba(85,242,122,.6)" : "none",
                                }}
                              >
                                {String(number).padStart(2, "0")}{index < game.numbers.length - 1 ? " · " : ""}
                              </b>
                            ))}
                          </div>
                          {checked.lottery === "dupla-sena" && checked.secondDrawNumbers.length > 0 && (
                            <div className="muted">Melhor resultado no {game.drawIndex}º sorteio.</div>
                          )}
                          {checked.lottery === "mais-milionaria" && (
                            <div className="muted">Trevos acertados: {game.trevoHits}</div>
                          )}
                        </div>
                        <span className="status">{game.hits} ACERTO{game.hits === 1 ? "" : "S"}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
