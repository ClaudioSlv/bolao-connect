type Props = {
  contestNumber?: number | null;
  drawAt?: string | null;
  estimatedPrizeCents?: number | null;
  status?: string | null;
  compact?: boolean;
};

const money = (c: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(c / 100);

const statusText = (s?: string | null) =>
  ({ open: "ABERTO", draft: "EM BREVE", closed: "ENCERRADO" })[s || ""] ||
  "EM PREPARAÇÃO";

export function DynamicLotofacilCover({
  contestNumber,
  drawAt,
  estimatedPrizeCents,
  status,
  compact = false,
}: Props) {
  const drawLabel = drawAt
    ? new Date(drawAt).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "Data aguardando confirmação da CAIXA";

  return (
    <div
      className={`dynamic-lotofacil-cover${compact ? " is-compact" : ""}`}
      role="img"
      aria-label={`Lotofácil, concurso ${contestNumber || "aguardando confirmação"}, ${statusText(status)}`}
    >
      <div className="dynamic-lotofacil-glow" aria-hidden="true" />
      <div className="dynamic-lotofacil-balls" aria-hidden="true">
        {[1, 5, 10, 15, 20, 25].map((n) => (
          <i key={n}>{String(n).padStart(2, "0")}</i>
        ))}
      </div>
      <div className="dynamic-lotofacil-copy">
        <small>JUNTASORTE · SÉRIE 20 EM 20</small>
        <strong>LOTOFÁCIL</strong>
        <b>CONCURSO {contestNumber || "—"}</b>
        {!compact && <span>Sorteio: {drawLabel}</span>}
        {!compact && estimatedPrizeCents ? (
          <span>Prêmio estimado: {money(Number(estimatedPrizeCents))}</span>
        ) : null}
      </div>
      <em>{statusText(status)}</em>
    </div>
  );
}
