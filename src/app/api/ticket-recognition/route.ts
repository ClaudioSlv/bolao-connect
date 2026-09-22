import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rules: Record<string, { label: string; min: number; max: number; allowRepeat?: boolean }> = {
  "mega-sena": { label: "Mega-Sena", min: 1, max: 60 },
  lotofacil: { label: "Lotofácil", min: 1, max: 25 },
  quina: { label: "Quina", min: 1, max: 80 },
  "dupla-sena": { label: "Dupla Sena", min: 1, max: 50 },
  lotomania: { label: "Lotomania", min: 0, max: 99 },
  timemania: { label: "Timemania", min: 1, max: 80 },
  "dia-de-sorte": { label: "Dia de Sorte", min: 1, max: 31 },
  "super-sete": { label: "Super Sete", min: 0, max: 9, allowRepeat: true },
  "mais-milionaria": { label: "+Milionária", min: 1, max: 50 },
};

type GeminiGame = { numbers?: unknown; trevos?: unknown };
type GeminiTicket = { contest?: unknown; games?: GeminiGame[] };

function validNumbers(values: unknown, min: number, max: number) {
  if (!Array.isArray(values)) return [];
  return values.map(Number).filter(
    (number) => Number.isInteger(number) && number >= min && number <= max,
  );
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Reconhecimento avançado ainda não configurado.", configured: false },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const image = form.get("image");
  const lottery = String(form.get("lottery") ?? "");
  const pick = Number(form.get("pick"));
  const rule = rules[lottery];

  if (!(image instanceof File) || !image.type.startsWith("image/"))
    return NextResponse.json({ error: "Envie uma foto válida." }, { status: 400 });
  if (image.size > 15 * 1024 * 1024)
    return NextResponse.json({ error: "A foto deve ter no máximo 15 MB." }, { status: 400 });
  if (!rule || !Number.isInteger(pick) || pick <= 0)
    return NextResponse.json({ error: "Modalidade ou quantidade inválida." }, { status: 400 });

  const bytes = Buffer.from(await image.arrayBuffer());
  const model = process.env.GEMINI_TICKET_MODEL || "gemini-2.5-flash";
  const prompt = [
    "Você é um leitor extremamente cuidadoso de bilhetes das Loterias CAIXA.",
    `A modalidade informada é ${rule.label}.`,
    `Cada jogo deve conter exatamente ${pick} números.`,
    `Aceite números somente entre ${rule.min} e ${rule.max}.`,
    "Transcreva as apostas linha por linha, respeitando exatamente os rótulos A, B, C e assim por diante.",
    "Cada aposta pode ocupar duas linhas impressas; una somente as duas linhas pertencentes ao mesmo rótulo.",
    "Antes de responder, conte novamente os números de cada aposta diretamente na imagem e confira cada dígito visualmente.",
    "Não use padrões de loteria nem números de outras apostas para preencher números apagados, cobertos ou duvidosos.",
    "Ignore valores, datas, códigos, QR Code, números do concurso e números de autenticação ao montar os jogos.",
    "Não invente, complete ou misture dezenas entre apostas.",
    "Se uma dezena estiver ilegível, omita o jogo inteiro.",
    "Retorne o concurso impresso quando estiver claramente legível.",
    "Para +Milionária, retorne também os trevos de cada jogo quando estiverem legíveis.",
  ].join(" ");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: image.type,
                  data: bytes.toString("base64"),
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                contest: { type: "INTEGER", nullable: true },
                games: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      numbers: { type: "ARRAY", items: { type: "INTEGER" } },
                      trevos: { type: "ARRAY", items: { type: "INTEGER" } },
                    },
                    required: ["numbers"],
                  },
                },
              },
              required: ["games"],
            },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error("gemini ticket recognition", response.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "O Gemini não conseguiu analisar esta foto." },
        { status: 502 },
      );
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();
    const parsed = JSON.parse(text || "{}") as GeminiTicket;
    const seen = new Set<string>();
    const games = (Array.isArray(parsed.games) ? parsed.games : []).flatMap((game) => {
      const numbers = validNumbers(game.numbers, rule.min, rule.max);
      if (numbers.length !== pick) return [];
      if (!rule.allowRepeat && new Set(numbers).size !== numbers.length) return [];
      const normalized = rule.allowRepeat ? numbers : [...numbers].sort((a, b) => a - b);
      const key = normalized.join("-");
      if (seen.has(key)) return [];
      seen.add(key);
      const trevos = lottery === "mais-milionaria"
        ? validNumbers(game.trevos, 1, 6)
        : [];
      return [{ numbers: normalized, trevos }];
    });

    return NextResponse.json({
      configured: true,
      source: "gemini",
      contest: Number.isInteger(Number(parsed.contest)) ? Number(parsed.contest) : null,
      games,
    });
  } catch (error) {
    console.error("gemini ticket recognition failed", error);
    return NextResponse.json(
      { error: "Não foi possível concluir a leitura avançada." },
      { status: 502 },
    );
  }
}
