import "server-only";
import {
  caixaResultUrl,
  supportedLotteries,
  type SupportedLottery,
} from "@/lib/lottery-results/config";

export type PersonalGame = { numbers: number[]; trevos?: number[] };
export type OfficialPrize = {
  tier: number;
  label: string;
  winners: number;
  value: number;
};
export type OfficialDraw = {
  available: boolean;
  lottery: SupportedLottery;
  contest: number;
  drawDate: string | null;
  numbers: number[];
  secondDrawNumbers: number[];
  trevos: number[];
  special: string | null;
  prizes: OfficialPrize[];
};

type CaixaResult = {
  numero?: number;
  dataApuracao?: string;
  listaDezenas?: string[];
  listaDezenasSegundoSorteio?: string[] | null;
  trevosSorteados?: string[] | null;
  listaTrevos?: string[] | null;
  nomeTimeCoracaoMesSorte?: string | null;
  listaRateioPremio?: Array<{
    faixa?: number;
    descricaoFaixa?: string;
    numeroDeGanhadores?: number;
    valorPremio?: number;
  }> | null;
};

const headers = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "User-Agent": "Mozilla/5.0 (compatible; BolaoAmigosBTP/1.0)",
};
const nums = (values?: string[] | null) =>
  (values ?? []).map(Number).filter(Number.isFinite);
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function isSupportedLottery(value: string): value is SupportedLottery {
  return supportedLotteries.includes(value as SupportedLottery);
}

export async function fetchOfficialPersonalDraw(
  lottery: SupportedLottery,
  contest: number,
): Promise<OfficialDraw> {
  const response = await fetch(caixaResultUrl(lottery, contest), {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) {
    return {
      available: false, lottery, contest, drawDate: null, numbers: [],
      secondDrawNumbers: [], trevos: [], special: null, prizes: [],
    };
  }
  if (!response.ok) throw new Error(`CAIXA HTTP ${response.status}`);
  const data = (await response.json()) as CaixaResult;
  if (Number(data.numero) !== contest || !data.listaDezenas?.length) {
    return {
      available: false, lottery, contest, drawDate: null, numbers: [],
      secondDrawNumbers: [], trevos: [], special: null, prizes: [],
    };
  }
  return {
    available: true,
    lottery,
    contest,
    drawDate: data.dataApuracao ?? null,
    numbers: nums(data.listaDezenas),
    secondDrawNumbers: nums(data.listaDezenasSegundoSorteio),
    trevos: nums(data.trevosSorteados ?? data.listaTrevos),
    special: data.nomeTimeCoracaoMesSorte ?? null,
    prizes: (data.listaRateioPremio ?? []).map((prize) => ({
      tier: Number(prize.faixa ?? 0),
      label: String(prize.descricaoFaixa ?? "").trim(),
      winners: Number(prize.numeroDeGanhadores ?? 0),
      value: Number(prize.valorPremio ?? 0),
    })),
  };
}

function hits(lottery: string, game: PersonalGame, drawn: number[]) {
  if (lottery === "super-sete")
    return game.numbers.reduce(
      (sum, number, index) => sum + (Number(drawn[index]) === Number(number) ? 1 : 0),
      0,
    );
  const set = new Set(drawn.map(Number));
  return game.numbers.filter((number) => set.has(Number(number))).length;
}

function prizeFor(
  lottery: string,
  prizes: OfficialPrize[],
  hitCount: number,
  trevoHits: number,
  drawIndex: number,
) {
  return prizes.find((prize) => {
    const label = normalize(prize.label);
    if (!label.includes(`${hitCount} acerto`)) return false;
    if (lottery === "mais-milionaria" && !label.includes(`${trevoHits} trevo`))
      return false;
    if (lottery === "dupla-sena") {
      if (drawIndex === 1 && /2.? sorteio|segundo sorteio/.test(label)) return false;
      if (drawIndex === 2 && /1.? sorteio|primeiro sorteio/.test(label)) return false;
    }
    return true;
  });
}

export function findWinningGames(
  lottery: SupportedLottery,
  games: PersonalGame[],
  draw: OfficialDraw,
) {
  const draws = [draw.numbers];
  if (draw.secondDrawNumbers.length) draws.push(draw.secondDrawNumbers);
  return games.flatMap((game, gameIndex) => {
    const trevoHits =
      lottery === "mais-milionaria"
        ? (game.trevos ?? []).filter((number) => draw.trevos.includes(Number(number))).length
        : 0;
    return draws.flatMap((numbers, index) => {
      const hitCount = hits(lottery, game, numbers);
      const prize = prizeFor(lottery, draw.prizes, hitCount, trevoHits, index + 1);
      return prize ? [{ gameIndex, hits: hitCount, trevoHits, drawIndex: index + 1, prize }] : [];
    });
  });
}
