"use client";

import Link from "next/link";
import { GameListWindow } from "@/components/game-list-window";
import { GameListScrollbar } from "@/components/game-list-scrollbar";
import { useEffect, useMemo, useRef, useState } from "react";
import { officialGamesCostCents } from "@/lib/lottery-pricing";
import { formatGameReference, withStableGameReferences } from "@/lib/game-reference";

type Game = { numbers: number[]; trevos?: number[]; referenceNumber?: number };
type Saved = {
  id: string;
  lottery: string;
  label: string;
  games: Game[];
  createdAt: string;
  targetContest?: number | null;
  totalCostCents?: number;
  participantToken?: string | null;
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
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadError, setLoadError] = useState("");
  const deleteLock = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [selectedLottery, setSelectedLottery] = useState("");
  const [draws, setDraws] = useState<Record<string, Draw>>({});
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [backHref, setBackHref] = useState("/meu-jogo");
  const [participantToken, setParticipantToken] = useState<string | null>(null);
  const contestInputRef = useRef<HTMLInputElement>(null);
  const [searchedContest, setSearchedContest] = useState<number | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searchedItemIds, setSearchedItemIds] = useState<string[]>([]);
  const [historicalTest, setHistoricalTest] = useState(false);
  const [selectedHits, setSelectedHits] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const requestedBack = new URLSearchParams(window.location.search).get("voltar");
    const token = requestedBack?.startsWith("/p/")
      ? requestedBack.slice(3).split(/[/?#]/)[0] || null : null;
    if (token) { setBackHref(requestedBack!); setParticipantToken(token); }
    const normalizeItems = (value: unknown): Saved[] => Array.isArray(value)
      ? value.filter(item => item && Array.isArray(item.games)).map(item => ({ ...item, games: withStableGameReferences(item.games) })) : [];
    let local: Saved[] = [];
    try {
      const all = normalizeItems(JSON.parse(localStorage.getItem(KEY) || "[]"));
      const scoped = token ? normalizeItems(JSON.parse(localStorage.getItem(`${KEY}:${token}`) || "[]")) : [];
      local = token ? [...new Map([...all.filter(item => item.participantToken === token), ...scoped].map(item => [item.id, item])).values()]
        : all.filter(item => !item.participantToken);
    } catch {}
    const load = async () => {
      try {
        const endpoint = token ? `/api/personal-games?token=${encodeURIComponent(token)}` : "/api/organizer-personal-games";
        const response = await fetch(endpoint, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Não foi possível carregar os jogos salvos.");
        const remote: Saved[] = (data.games ?? []).map((item: { id: string; lottery: string; contest?: number; contest_number?: number; games: Game[]; createdAt?: string; created_at?: string }) => ({
          id: item.id, lottery: item.lottery,
          label: item.lottery === "mega-sena" ? "Mega-Sena" : item.lottery === "lotofacil" ? "Lotofácil" : item.lottery,
          games: withStableGameReferences(item.games),
          createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
          targetContest: item.contest ?? item.contest_number,
          totalCostCents: officialGamesCostCents(item.lottery, item.games),
          participantToken: token,
        }));
        // Remote rows belong to the authenticated owner/token. Keep only local-only
        // pending rows; do not resurrect deleted remote rows from an old cache.
        const pending = token ? local.filter(item => !/^[0-9a-f]{8}-/i.test(item.id)) : [];
        const saved = [...new Map([...pending, ...remote].map(item => [item.id, item])).values()];
        if (cancelled) return;
        setItems(saved);
        setSelectedLottery(saved[0]?.lottery ?? "");
        if (token) try { localStorage.setItem(`${KEY}:${token}`, JSON.stringify(saved)); } catch {}
      } catch (error) {
        if (cancelled) return;
        setItems(local);
        setSelectedLottery(local[0]?.lottery ?? "");
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os jogos salvos.");
      } finally { if (!cancelled) setLoadingGames(false); }
    };
    void load();
    return () => { cancelled = true; };
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
  const searchedDraw =
    searchedContest === null
      ? undefined
      : draws[`${selectedLottery}:${searchedContest}`];
  const displayedVisible =
    selectedHits === null || !searchedDraw?.available
      ? visible
      : visible
          .map((item) => ({
            ...item,
            games: item.games.filter(
              (game) => checkGame(item, game, searchedDraw).hits === selectedHits,
            ),
          }))
          .filter((item) => item.games.length > 0);

  const searchContest = async () => {
    const contest = Number(contestInputRef.current?.value);
    if (!Number.isInteger(contest) || contest <= 0) {
      setSearchError("Informe um número de concurso válido.");
      setSearchedContest(null);
      setSearchedItemIds([]);
      setHistoricalTest(false);
      setSelectedHits(null);
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
      setSelectedHits(null);
      return;
    }

    setSearchError("");
    setSearchedContest(contest);
    setSearchedItemIds(found.map((item) => item.id));
    setHistoricalTest(contestItems.length === 0);
    setSelectedHits(null);
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
          `/api/lottery-result?lottery=${encodeURIComponent(lottery)}&contest=${targetContest}`,
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

  const lotofacilSearchSummary = useMemo(() => {
    if (
      selectedLottery !== "lotofacil" ||
      searchedContest === null ||
      !searchedDraw?.available
    )
      return null;

    const counts = new Map<number, number>();
    let total = 0;
    for (const item of visible) {
      for (const game of item.games) {
        const checked = checkGame(item, game, searchedDraw);
        counts.set(checked.hits, (counts.get(checked.hits) ?? 0) + 1);
        total += 1;
      }
    }

    return {
      total,
      rows: [15, 14, 13, 12, 11].map((hits) => ({
        hits,
        count: counts.get(hits) ?? 0,
      })),
    };
  }, [searchedContest, searchedDraw, selectedLottery, visible]);

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
            detail: `Jogo ${game.referenceNumber ?? index + 1}`,
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

  const shareSaved = async (item: Saved) => {
    if (sharingId) return;
    setSharingId(item.id);
    try {
      const { shareGamesPdf } = await import("@/lib/game-pdf");
      await shareGamesPdf(`${item.label}${item.targetContest ? ` - Concurso ${item.targetContest}` : ""}`, item.games.map((game, index) => {
        const reference = game.referenceNumber ?? index + 1;
        return `Jogo ${reference}: ${game.numbers.map(n => String(n).padStart(2, "0")).join(" ")}${game.trevos?.length ? ` | Trevos: ${game.trevos.join(" ")}` : ""} | ${formatGameReference(reference)}`;
      }));
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") alert("Não foi possível compartilhar o PDF. Tente novamente.");
    } finally { setSharingId(null); }
  };

  const remove = async (id: string) => {
    if (deleteLock.current) return;
    deleteLock.current = true;
    setDeletingId(id);
    setDeleteMessage("Excluindo jogos, aguarde…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
    await new Promise<void>(resolve => window.setTimeout(resolve, 40));
    // Registros antigos do participante usavam um id local (timestamp-random).
    // Eles não existem com esse mesmo id no banco e devem poder ser apagados
    // normalmente do aparelho. Registros novos usam UUID e são removidos também
    // da persistência remota.
    const isPersistentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    if (isPersistentId) {
      try {
        const endpoint = participantToken ? "/api/personal-games" : "/api/organizer-personal-games";
        const response = await fetch(endpoint, {
          method: "DELETE",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(participantToken ? { id, token: participantToken } : { id }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(data?.error || "Não foi possível excluir o jogo.");
        }
      } catch (error) {
        setDeleteMessage(controller.signal.aborted
          ? "A confirmação da exclusão demorou demais. Atualize a lista antes de tentar novamente."
          : error instanceof Error ? error.message : "Não foi possível excluir o jogo.");
        return;
      }
    }

    const next = items.filter((item) => item.id !== id);
    setItems(next);
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
      const allStored = Array.isArray(stored) ? (stored as Saved[]) : [];
      localStorage.setItem(KEY, JSON.stringify(allStored.filter((item) => item.id !== id)));
      if (participantToken) localStorage.setItem(`${KEY}:${participantToken}`, JSON.stringify(next));
    } catch {}
    if (!next.some((item) => item.lottery === selectedLottery))
      setSelectedLottery(next[0]?.lottery ?? "");
    setDeleteMessage("Jogos excluídos com sucesso.");
    } finally {
      window.clearTimeout(timeout);
      deleteLock.current = false;
      setDeletingId(null);
    }
  };

  return (
    <main className="shell">
      <Link className="back" href={backHref}>
        ← Voltar
      </Link>

      <section className="section">
        <p className="eyebrow">JOGOS PESSOAIS</p>
        <h1>✅ Conferir resultado</h1>
        {deleteMessage && <p role="status" aria-live="polite">{deleteMessage}</p>}
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
                ref={contestInputRef}
                aria-label="Número do concurso"
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

      {lotofacilSearchSummary && (
        <section className="section">
          <p className="eyebrow">RESULTADO DO TESTE — CONCURSO {searchedContest}</p>
          <h2>Quantidade de acertos</h2>
          <div className="list">
            {lotofacilSearchSummary.rows.map(({ hits, count }) => (
              <button
                className="list-item"
                key={hits}
                type="button"
                aria-pressed={selectedHits === hits}
                onClick={() => setSelectedHits((current) => current === hits ? null : hits)}
                style={{
                  width: "100%",
                  color: "inherit",
                  cursor: count ? "pointer" : "default",
                  borderColor: selectedHits === hits ? "#f7c948" : undefined,
                  boxShadow: selectedHits === hits ? "0 0 14px rgba(247,201,72,.35)" : undefined,
                }}
                disabled={count === 0}
              >
                <strong>Jogos com {hits} pontos</strong>
                <span className="status">
                  {count} JOGO{count === 1 ? "" : "S"}
                  {selectedHits === hits ? " · SELECIONADOS" : ""}
                </span>
              </button>
            ))}
          </div>
          {selectedHits !== null && (
            <button
              className="button secondary"
              type="button"
              onClick={() => setSelectedHits(null)}
            >
              MOSTRAR TODOS OS JOGOS
            </button>
          )}
          <p className="muted">
            Total conferido: {lotofacilSearchSummary.total} jogos. As dezenas
            acertadas continuam destacadas em verde em cada jogo abaixo.
          </p>
        </section>
      )}

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

      {loadError && <p className="status" role="alert">{loadError} Os jogos disponíveis neste aparelho foram mantidos.</p>}
      {loadingGames ? <section className="section"><p role="status">Carregando jogos salvos...</p></section> : items.length === 0 ? (
        <section className="section">
          <p>Nenhum jogo salvo neste aparelho.</p>
          <Link className="button primary" href={participantToken ? `/meu-jogo?voltar=${encodeURIComponent(backHref)}` : "/meu-jogo"}>
            🎲 CRIAR UM JOGO
          </Link>
        </section>
      ) : (
        displayedVisible.map((item) => {
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
                  disabled={deletingId !== null}
                  aria-busy={deletingId === item.id}
                  onClick={() => remove(item.id)}
                >
                  {deletingId === item.id ? "⏳ Excluindo…" : "🗑️ Excluir"}
                </button>
              </div>

              <button className="button primary" type="button" disabled={sharingId !== null} onClick={() => shareSaved(item)} style={{ margin: "12px 0" }}>
                {sharingId === item.id ? "⏳ PREPARANDO PDF..." : "📲 COMPARTILHAR PDF"}
              </button>

              {contest && draw && !draw.available && (
                <div className="status">Aguardando resultado do concurso {contest}.</div>
              )}

              <GameListScrollbar count={item.games.length} listId={`saved-game-list-${item.id}`} />
              <GameListWindow listId={`saved-game-list-${item.id}`} count={item.games.length} renderRow={(index) => {
                  const game = item.games[index];
                  const referenceNumber = game.referenceNumber ?? index + 1;
                  const checked =
                    contest && draw?.available
                      ? checkGame(item, game, draw)
                      : null;
                  const matched = new Set(checked?.matched.map(Number) ?? []);

                  return (
                    <div className="list-item" key={referenceNumber} style={{ height: "100%", overflow: "auto" }}>
                      <strong>Jogo {referenceNumber}</strong>
                      <small className="muted">{formatGameReference(referenceNumber)}</small>
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
                        ) : item.lottery === "lotofacil" && checked.hits >= 11 ? (
                          <div style={{ marginTop: 8, color: "#31d67b", fontWeight: 800 }}>
                            PREMIADO — {checked.hits} acertos
                          </div>
                        ) : (
                          <div className="muted" style={{ marginTop: 8 }}>
                            Não premiado — {checked.hits} acertos.
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                }} />

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
