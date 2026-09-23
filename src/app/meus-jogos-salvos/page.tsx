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
type Prize = {
  tier: number;
  label: string;
  winners: number;
  value: number;
};
type Draw = {
  available: boolean;
  lottery: string;
  contest: number;
  drawDate?: string | null;
  numbers?: number[];
  secondDrawNumbers?: number[];
  trevos?: number[];
  special?: string | null;
  prizes?: Prize[];
};

const KEY = "bolao-amigos-btp:jogos-salvos";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function gameHits(lottery: string, game: Game, numbers: number[]) {
  if (lottery === "super-sete") {
    return game.numbers.reduce(
      (total, number, index) => total + (Number(numbers[index]) === Number(number) ? 1 : 0),
      0,
    );
  }
  const drawn = new Set(numbers.map(Number));
  return game.numbers.filter((number) => drawn.has(Number(number))).length;
}

function matchedNumbers(lottery: string, game: Game, numbers: number[]) {
  if (lottery === "super-sete") {
    return game.numbers.filter(
      (number, index) => Number(numbers[index]) === Number(number),
    );
  }
  const drawn = new Set(numbers.map(Number));
  return game.numbers.filter((number) => drawn.has(Number(number)));
}

function findPrize(
  lottery: string,
  prizes: Prize[],
  hits: number,
  trevoHits: number,
  drawIndex: number,
) {
  return prizes.find((prize) => {
    const label = normalize(prize.label);
    if (!label.includes(`${hits} acerto`)) return false;
    if (lottery === "mais-milionaria" && !label.includes(`${trevoHits} trevo`))
      return false;
    if (lottery === "dupla-sena") {
      const mentionsFirst = /1.? sorteio|primeiro sorteio/.test(label);
      const mentionsSecond = /2.? sorteio|segundo sorteio/.test(label);
      if (drawIndex === 1 && mentionsSecond) return false;
      if (drawIndex === 2 && mentionsFirst) return false;
    }
    return true;
  });
}

function checkGame(item: Saved, game: Game, draw: Draw) {
  const draws = [draw.numbers ?? []];
  if (draw.secondDrawNumbers?.length) draws.push(draw.secondDrawNumbers);

  const trevoHits =
    item.lottery === "mais-milionaria"
      ? (game.trevos ?? []).filter((number) =>
          (draw.trevos ?? []).map(Number).includes(Number(number)),
        ).length
      : 0;

  const checks = draws.map((numbers, index) => {
    const hits = gameHits(item.lottery, game, numbers);
    const matched = matchedNumbers(item.lottery, game, numbers);
    const prize = findPrize(
      item.lottery,
      draw.prizes ?? [],
      hits,
      trevoHits,
      index + 1,
    );
    return { hits, matched, prize, drawIndex: index + 1 };
  });

  return checks.reduce((best, current) => {
    if (current.prize && !best.prize) return current;
    if (current.prize && best.prize && current.prize.value > best.prize.value)
      return current;
    return current.hits > best.hits ? current : best;
  }, checks[0]);
}

export default function SavedGamesPage() {
  const [items, setItems] = useState<Saved[]>([]);
  const [selectedLottery, setSelectedLottery] = useState("");
  const [draws, setDraws] = useState<Record<string, Draw>>({});
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [backHref, setBackHref] = useState("/meu-jogo");
  const [contestInput, setContestInput] = useState("");
  const [searchedContest, setSearchedContest] = useState<number | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searchedItemIds, setSearchedItemIds] = useState<string[]>([]);
  const [historicalTest, setHistoricalTest] = useState(false);

  useEffect(() => {
    const requestedBack = new URLSearchParams(window.location.search).get("voltar");
    if (requestedBack?.startsWith("/p/")) setBackHref(requestedBack);
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      const saved = Array.isArray(value) ? (value as Saved[]) : [];
      setItems(saved);
      setSelectedLottery(saved[0]?.lottery ?? "");
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;

    async function checkResults() {
      const targets = Array.from(
        new Map(
          items
            .filter((item) => Number(item.targetContest) > 0)
            .map((item) => [
              `${item.lottery}:${item.targetContest}`,
              { lottery: item.lottery, contest: Number(item.targetContest) },
            ]),
        ).values(),
      );
      if (!targets.length) return;

      setChecking(true);
      const settled = await Promise.allSettled(
        targets.map(async ({ lottery, contest }) => {
          const response = await fetch(
            `/api/personal-game-result?lottery=${encodeURIComponent(lottery)}&contest=${contest}`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("resultado indisponível");
          return (await response.json()) as Draw;
        }),
      );

      if (!cancelled) {
        setDraws((current) => {
          const next = { ...current };
          settled.forEach((result, index) => {
            if (result.status === "fulfilled") {
              const target = targets[index];
              next[`${target.lottery}:${target.contest}`] = result.value;
            }
          });
          return next;
        });
        setLastCheckedAt(new Date());
        setChecking(false);
      }
    }

    checkResults();
    const timer = window.setInterval(checkResults, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [items]);

  const visible = items.filter(
    (item) =>
      item.lottery === selectedLottery &&
      (searchedContest === null || searchedItemIds.includes(item.id)),
  );

  const searchContest = async () => {
    const contest = Number(contestInput);
    if (!Number.isInteger(contest) || contest <= 0) {
      setSearchError("Informe um número de concurso válido.");
      setSearchedContest(null);
      setSearchedItemIds([]);
      setHistoricalTest(false);
      return;
    }

    const contestItems = items.filter((item) => Number(item.targetContest) === contest);
    const latestLotteryItem = items
      .filter((item) => item.lottery === selectedLottery)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const found = contestItems.length
      ? contestItems
      : latestLotteryItem
        ? [latestLotteryItem]
        : [];
    if (!found.length) {
      setSearchError("Nenhum jogo pessoal salvo foi encontrado para realizar o teste.");
      setSearchedContest(null);
      setSearchedItemIds([]);
      setHistoricalTest(false);
      return;
    }

    setSearchError("");
    setSearchedContest(contest);
    setSearchedItemIds(found.map((item) => item.id));
    setHistoricalTest(contestItems.length === 0);
    setSelectedLottery(found[0].lottery);

    const targets = Array.from(
      new Map(
        found.map((item) => [
          `${item.lottery}:${contest}`,
          { lottery: item.lottery, contest },
        ]),
      ).values(),
    );

    setChecking(true);
    const settled = await Promise.allSettled(
      targets.map(async ({ lottery, contest: targetContest }) => {
        const response = await fetch(
          `/api/personal-game-result?lottery=${encodeURIComponent(lottery)}&contest=${targetContest}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("resultado indisponível");
        return (await response.json()) as Draw;
      }),
    );

    setDraws((current) => {
      const next = { ...current };
      settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const target = targets[index];
          next[`${target.lottery}:${target.contest}`] = result.value;
        }
      });
      return next;
    });
    setLastCheckedAt(new Date());
    setChecking(false);
  };

  const searchedLotteries = useMemo(
    () =>
      searchedContest === null
        ? []
        : Array.from(
            new Map(
              items
                .filter((item) => searchedItemIds.includes(item.id))
                .map((item) => [item.lottery, item.label]),
            ).entries(),
          ),
    [items, searchedContest, searchedItemIds],
  );

  const performance = useMemo(() => {
    const bars = items
      .flatMap((item) => {
        const contest = Number(item.targetContest);
        const draw = contest ? draws[`${item.lottery}:${contest}`] : undefined;
        if (!draw?.available || !item.games.length) return [];
        const totalItemCostCents =
          item.totalCostCents ?? officialGamesCostCents(item.lottery, item.games);
        const costPerGame = Math.floor(totalItemCostCents / item.games.length);
        const costRemainder = totalItemCostCents % item.games.length;

        return item.games.map((game, index) => {
          const checked = checkGame(item, game, draw);
          const costCents = costPerGame + (index < costRemainder ? 1 : 0);
          const prizeCents = Math.round(Number(checked?.prize?.value ?? 0) * 100);
          return {
            id: `${item.id}-${index}`,
            label: `${item.label.replace("Mega-Sena", "Mega").replace("Lotofácil", "Loto")} ${contest}`,
            detail: `Jogo ${index + 1}`,
            createdAt: item.createdAt,
            costCents,
            prizeCents,
            balanceCents: prizeCents - costCents,
          };
        });
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const totalCostCents = bars.reduce((total, bar) => total + bar.costCents, 0);
    const totalPrizeCents = bars.reduce((total, bar) => total + bar.prizeCents, 0);
    const maxAbsoluteCents = Math.max(
      1,
      ...bars.map((bar) => Math.abs(bar.balanceCents)),
    );

    return {
      bars,
      totalCostCents,
      totalPrizeCents,
      balanceCents: totalPrizeCents - totalCostCents,
      maxAbsoluteCents,
    };
  }, [draws, items]);

  const remove = async (id: string) => {
    const removed = items.find((item) => item.id === id);
    const poolId = new URLSearchParams(window.location.search).get("pool") ?? "";

    if (removed && poolId) {
      try {
        const response = await fetch("/api/manual-lottery-results", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poolId, lottery: removed.lottery }),
        });
        if (!response.ok) {
          window.alert(
            "Não foi possível excluir agora. Tente novamente para não deixar um resultado antigo publicado.",
          );
          return;
        }
      } catch {
        window.alert(
          "Sem conexão para concluir a exclusão. Tente novamente em instantes.",
        );
        return;
      }
    }

    const next = items.filter((item) => item.id !== id);
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    if (!next.some((item) => item.lottery === selectedLottery))
      setSelectedLottery(next[0]?.lottery ?? "");
  };

  return (
    <main className="shell">
      <Link className="back" href={backHref}>
        ← Voltar
      </Link>

      <section className="section">
        <p className="eyebrow">JOGOS PESSOAIS</p>
        <h1>✅ Conferir resultado</h1>
        <p className="muted">
          Digite somente o número do concurso. O sistema localiza os jogos que
          você fez neste aparelho e confere pelo resultado oficial da CAIXA.
        </p>
        {items.length > 0 && (
          <>
            <div className="field">
              <label>Número do concurso</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={contestInput}
                onChange={(event) => {
                  setContestInput(event.target.value.replace(/\D/g, ""));
                  setSearchError("");
                  setHistoricalTest(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchContest();
                  }
                }}
                placeholder="Digite o número do concurso"
              />
            </div>
            <button
              className="button primary"
              type="button"
              onClick={() => void searchContest()}
              disabled={checking}
            >
              {checking ? "AGUARDE, ESTAMOS CONFERINDO..." : "BUSCAR E CONFERIR MEUS JOGOS"}
            </button>
            {searchError && (
              <p className="status" role="alert" style={{ color: "#facc15" }}>
                {searchError}
              </p>
            )}
          </>
        )}
        {searchedContest !== null && searchedLotteries.length > 1 && (
          <div className="field">
            <label>Modalidades encontradas no concurso {searchedContest}</label>
            <select
              value={selectedLottery}
              onChange={(event) => setSelectedLottery(event.target.value)}
            >
              {searchedLotteries.map(([lottery, label]) => (
                <option value={lottery} key={lottery}>
                  {label} ({items.filter((item) => item.lottery === lottery && searchedItemIds.includes(item.id)).reduce((sum, item) => sum + item.games.length, 0)} jogos)
                </option>
              ))}
            </select>
          </div>
        )}
        {searchedContest !== null && !searchError && (
          <div className="status" role="status">
            {historicalTest ? "Teste histórico" : "Conferência do concurso"} {searchedContest}: {items.filter((item) => searchedItemIds.includes(item.id)).reduce((sum, item) => sum + item.games.length, 0)} jogos
            {historicalTest ? " do conjunto mais recente" : " encontrados"}.
          </div>
        )}
        <div className="status" role="status" aria-live="polite">
          {checking
            ? "Consultando os resultados..."
            : lastCheckedAt
              ? `Conferência atualizada às ${lastCheckedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Nova verificação automática em até 5 minutos.`
              : "Aguardando a primeira conferência."}
        </div>
      </section>

      {items.length > 0 && (
        <section className="section performance-card">
          <div className="performance-heading">
            <div>
              <p className="eyebrow">DESEMPENHO GERAL</p>
              <h2>Resultado financeiro</h2>
            </div>
            <div
              className={`performance-status ${
                performance.balanceCents >= 0
                  ? "is-positive"
                  : "is-negative"
              }`}
            >
              <span>{performance.balanceCents >= 0 ? "LUCRO" : "PREJUÍZO"}</span>
              <strong>{money.format(Math.abs(performance.balanceCents) / 100)}</strong>
            </div>
          </div>

          <div className="performance-totals">
            <div>
              <i className="performance-kpi-dot invested" aria-hidden="true" />
              <span>Total apostado</span>
              <strong>{money.format(performance.totalCostCents / 100)}</strong>
            </div>
            <div>
              <i className="performance-kpi-dot received" aria-hidden="true" />
              <span>Total recebido</span>
              <strong>{money.format(performance.totalPrizeCents / 100)}</strong>
            </div>
            <div>
              <i className={`performance-kpi-dot ${performance.balanceCents >= 0 ? "positive" : "negative"}`} aria-hidden="true" />
              <span>Saldo</span>
              <strong
                className={
                  performance.balanceCents >= 0
                    ? "performance-positive"
                    : "performance-negative"
                }
              >
                {money.format(performance.balanceCents / 100)}
              </strong>
            </div>
          </div>

          {performance.bars.length ? (
            <div className="performance-chart-frame">
              <div className="performance-chart-caption">
                <strong>Evolução por jogo</strong>
                <div className="performance-legend" aria-label="Legenda">
                  <span><i className="positive" /> Lucro</span>
                  <span><i className="negative" /> Prejuízo</span>
                </div>
              </div>
              <div className="performance-chart-scroll">
                <div
                  className="performance-chart"
                  style={{ minWidth: `${Math.max(100, performance.bars.length * 66)}px` }}
                  role="img"
                  aria-label="Gráfico do lucro ou prejuízo de todos os jogos conferidos"
                >
                  <div className="performance-grid-line line-25" />
                  <div className="performance-zero-line"><span>ZERO</span></div>
                  <div className="performance-grid-line line-75" />
                  {performance.bars.map((bar) => {
                    const positive = bar.balanceCents >= 0;
                    const height = Math.max(
                      6,
                      Math.round(
                        (Math.abs(bar.balanceCents) / performance.maxAbsoluteCents) * 76,
                      ),
                    );
                    return (
                      <div className="performance-bar-column" key={bar.id}>
                        <div className="performance-bar-area">
                          <span
                            className={`performance-bar-value ${positive ? "is-positive" : "is-negative"}`}
                            style={positive ? { bottom: `${108 + height}px` } : { top: `${108 + height}px` }}
                          >
                            {bar.balanceCents > 0 ? "+" : ""}{money.format(bar.balanceCents / 100)}
                          </span>
                          <div
                            className={`performance-bar ${positive ? "is-positive" : "is-negative"}`}
                            style={{ height: `${height}px` }}
                            title={`${bar.label} · ${bar.detail}: ${money.format(bar.balanceCents / 100)}`}
                          />
                        </div>
                        <small>{bar.label}</small>
                        <b>{bar.detail}</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">
              O gráfico aparecerá assim que sair o resultado dos jogos salvos.
            </p>
          )}
          <p className="muted performance-note">
            Verde indica lucro e vermelho indica prejuízo. O custo usa o preço
            oficial da CAIXA registrado quando o jogo é salvo.
          </p>
        </section>
      )}

      {items.length === 0 ? (
        <section className="section">
          <p>Nenhum jogo salvo neste aparelho.</p>
          <Link className="button primary" href="/meu-jogo">
            🎲 CRIAR UM JOGO
          </Link>
        </section>
      ) : (
        visible.map((item) => {
          const contest = searchedContest ?? Number(item.targetContest);
          const draw = contest
            ? draws[`${item.lottery}:${contest}`]
            : undefined;

          return (
            <section className="section" key={item.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0 }}>{item.label}</h2>
                  <p className="muted">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {contest ? (
                    <strong>Concurso {contest}</strong>
                  ) : (
                    <span className="status">
                      Concurso não identificado — salve novamente para ativar a
                      conferência automática.
                    </span>
                  )}
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => remove(item.id)}
                >
                  🗑️ Excluir
                </button>
              </div>

              {contest && draw && !draw.available && (
                <div className="status">Aguardando resultado do concurso {contest}.</div>
              )}

              <div className="list">
                {item.games.map((game, index) => {
                  const checked =
                    contest && draw?.available
                      ? checkGame(item, game, draw)
                      : null;
                  const matched = new Set(checked?.matched.map(Number) ?? []);

                  return (
                    <div className="list-item" key={index}>
                      <strong>Jogo {index + 1}</strong>
                      <span>
                        {game.numbers.map((number, numberIndex) => (
                          <b
                            key={numberIndex}
                            style={{
                              color: matched.has(Number(number))
                                ? "#55f27a"
                                : "inherit",
                              textShadow: matched.has(Number(number))
                                ? "0 0 8px rgba(85,242,122,.6)"
                                : "none",
                            }}
                          >
                            {String(number).padStart(2, "0")}
                            {numberIndex < game.numbers.length - 1 ? " · " : ""}
                          </b>
                        ))}
                        {game.trevos?.length
                          ? ` | Trevos: ${game.trevos.map((number) => String(number).padStart(2, "0")).join(" · ")}`
                          : ""}
                      </span>

                      {!contest ? null : !draw?.available ? (
                        <span className="muted">Aguardando resultado.</span>
                      ) : checked ? (
                        checked.prize ? (
                          <div
                            className="status"
                            style={{
                              borderColor: "#36e56b",
                              color: "#7cff9c",
                              marginTop: 8,
                            }}
                          >
                            PREMIADO — {checked.hits} acertos
                            {item.lottery === "mais-milionaria"
                              ? ` · ${(game.trevos ?? []).filter((number) => (draw.trevos ?? []).map(Number).includes(Number(number))).length} trevo(s)`
                              : ""}
                            {" · "}
                            {checked.prize.label}
                            {checked.prize.value > 0
                              ? ` · ${money.format(checked.prize.value)}`
                              : ""}
                          </div>
                        ) : (
                          <div className="muted" style={{ marginTop: 8 }}>
                            Não premiado — {checked.hits} acertos.
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {draw?.available && (
                <p className="muted" style={{ fontSize: 12 }}>
                  Resultado oficial do concurso {draw.contest}
                  {draw.drawDate ? ` · ${draw.drawDate}` : ""}. Em apostas com
                  mais dezenas, o valor exibido corresponde ao rateio oficial da
                  faixa e deve ser validado no comprovante.
                </p>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
