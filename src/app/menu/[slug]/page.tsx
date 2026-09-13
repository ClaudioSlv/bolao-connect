import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { PoolSwitcher } from "@/components/pool-switcher";
import { BackupRestoreForm } from "@/components/backup-restore-form";
import { adminMenu } from "@/lib/admin-menu";
import { createClient } from "@/lib/supabase/server";
import {
  correctPayment,
  creditPrize,
  createPrizeDistribution,
  editParticipant,
  markPrizePixPaid,
  reactivateParticipant,
  resolveAppError,
  reversePayment,
  saveLegalDocument,
} from "@/app/actions/admin-modules";
export const dynamic = "force-dynamic";
const money = (c: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(c / 100);
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pool?: string; q?: string; status?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const item = adminMenu.find((x) => x.slug === slug);
  if (!item) notFound();
  const s = await createClient();
  const { data: auth } = await s.auth.getUser();
  if (!auth.user)
    return (
      <main className="shell">
        <p>Entre como organizador.</p>
      </main>
    );
  const { data: all } = await s
    .from("pools")
    .select("id,title,lottery,share_price_cents")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });
  const pools = all ?? [];
  const pool = pools.find((x) => x.id === query.pool) ?? pools[0];
  if (!pool)
    return (
      <main className="shell">
        <Link className="back" href="/menu">
          ← Menu
        </Link>
        <p>Crie um bolão primeiro.</p>
      </main>
    );
  const participantTool = item.category === "Participantes";
  let participants: any[] = [];
  if (participantTool) {
    const { data } = await s
      .from("participants")
      .select("id,name,phone,shares,status,payment_status")
      .eq("pool_id", pool.id)
      .order("name");
    const term = (query.q || "").toLowerCase(),
      status = query.status || "all";
    participants = (data ?? []).filter(
      (p) =>
        (!term ||
          p.name.toLowerCase().includes(term) ||
          String(p.phone || "").includes(term)) &&
        (status === "all" ||
          (status === "waitlist"
            ? p.status === "waitlist"
            : status === "cancelled"
              ? p.status === "cancelled"
              : p.payment_status === status)),
    );
  }
  const needsPeople = [
    "relatorio-inadimplentes",
    "mensagens-cobranca",
    "avisos-parciais",
  ].includes(slug);
  let paymentRows: any[] = [];
  let peopleRows: any[] = [];
  let moduleRows: any[] = [];
  if (
    ["corrigir-parcela", "estornar-pagamento", "historico-parcelas"].includes(
      slug,
    )
  ) {
    const { data } = await s
      .from("payments")
      .select(
        "id,participant_id,amount_cents,credit_used_cents,status,payment_method,created_at,participants(name)",
      )
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: false });
    paymentRows = data ?? [];
  }
  if (needsPeople) {
    const { data: ps } = await s
      .from("participants")
      .select("id,name,phone,shares,status,payment_status")
      .eq("pool_id", pool.id)
      .neq("status", "cancelled")
      .order("name");
    const { data: pays } = await s
      .from("payments")
      .select("participant_id,amount_cents,credit_used_cents,status")
      .eq("pool_id", pool.id)
      .in("status", ["partial", "confirmed"]);
    const received = new Map<string, number>();
    for (const row of pays ?? [])
      received.set(
        row.participant_id,
        (received.get(row.participant_id) || 0) +
          Number(row.amount_cents || 0) +
          Number(row.credit_used_cents || 0),
      );
    peopleRows = (ps ?? [])
      .map((p) => ({
        ...p,
        total: Number(p.shares) * Number(pool.share_price_cents),
        received: received.get(p.id) || 0,
      }))
      .filter((p) =>
        slug === "avisos-parciais"
          ? p.received > 0 && p.received < p.total
          : p.received < p.total,
      );
  }
  if (slug === "distribuir-premios" || slug === "creditar-premio") {
    const { data } = await s
      .from("prize_allocations")
      .select(
        "id,amount_cents,destination,paid_at,participants(name,phone),prize_events(description,created_at)",
      )
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: false });
    moduleRows = data ?? [];
  } else if (slug === "painel-erros") {
    const { data } = await s
      .from("app_error_logs")
      .select("id,source,message,resolved_at,created_at")
      .or(`pool_id.eq.${pool.id},pool_id.is.null`)
      .order("created_at", { ascending: false });
    moduleRows = data ?? [];
  } else if (slug === "documentos-legais") {
    const { data } = await s
      .from("legal_documents")
      .select("id,kind,title,content,version")
      .eq("owner_id", auth.user.id);
    moduleRows = data ?? [];
  }
  return (
    <main className="shell">
      <Link className="back" href="/menu">
        ← Voltar ao Menu
      </Link>
      <section className="section">
        <p className="eyebrow">{item.category.toUpperCase()}</p>
        <h1>
          {item.icon} {item.title}
        </h1>
        <PoolSwitcher
          pools={pools}
          activeId={pool.id}
          basePath={`/menu/${slug}`}
        />
      </section>
      {participantTool ? (
        <section className="section">
          <form className="form" method="get">
            <input type="hidden" name="pool" value={pool.id} />
            <div className="field">
              <label>Nome ou WhatsApp</label>
              <input name="q" defaultValue={query.q || ""} />
            </div>
            <div className="field">
              <label>Situação</label>
              <select name="status" defaultValue={query.status || "all"}>
                <option value="all">Todos</option>
                <option value="confirmed">Pagos</option>
                <option value="partial">Parciais</option>
                <option value="pending">Pendentes</option>
                <option value="waitlist">Lista de espera</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
            <button className="button primary">BUSCAR</button>
          </form>
          <div className="list" style={{ marginTop: 16 }}>
            {participants.map((p) => (
              <form
                className="card form"
                action={
                  p.status === "cancelled"
                    ? reactivateParticipant
                    : editParticipant
                }
                key={p.id}
              >
                <input type="hidden" name="poolId" value={pool.id} />
                <input type="hidden" name="participantId" value={p.id} />
                <div className="field">
                  <label>Nome</label>
                  <input
                    name="name"
                    defaultValue={p.name}
                    disabled={p.status === "cancelled"}
                  />
                </div>
                <div className="field">
                  <label>WhatsApp</label>
                  <input
                    name="phone"
                    defaultValue={p.phone || ""}
                    disabled={p.status === "cancelled"}
                  />
                </div>
                <div className="field">
                  <label>Cotas</label>
                  <input
                    name="shares"
                    type="number"
                    min="1"
                    max="2"
                    defaultValue={p.shares}
                    disabled={p.status === "cancelled"}
                  />
                </div>
                <span>{p.payment_status}</span>
                <button className="button secondary">
                  {p.status === "cancelled" ? "REATIVAR" : "SALVAR"}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : [
          "corrigir-parcela",
          "estornar-pagamento",
          "historico-parcelas",
        ].includes(slug) ? (
        <section className="section list">
          {paymentRows.length ? (
            paymentRows.map((row) => (
              <form
                className="card form"
                action={
                  slug === "corrigir-parcela" ? correctPayment : reversePayment
                }
                key={row.id}
              >
                <input type="hidden" name="poolId" value={pool.id} />
                <input type="hidden" name="paymentId" value={row.id} />
                <strong>{row.participants?.name || "Participante"}</strong>
                <span>
                  {money(Number(row.amount_cents || 0))} ·{" "}
                  {row.payment_method || "não informado"} ·{" "}
                  {new Date(row.created_at).toLocaleDateString("pt-BR")}
                </span>
                {slug === "corrigir-parcela" && (
                  <div className="field">
                    <label>Novo valor (R$)</label>
                    <input
                      name="newAmount"
                      inputMode="decimal"
                      defaultValue={(Number(row.amount_cents || 0) / 100)
                        .toFixed(2)
                        .replace(".", ",")}
                    />
                  </div>
                )}
                {slug !== "historico-parcelas" && (
                  <>
                    <div className="field">
                      <label>Motivo</label>
                      <input name="reason" minLength={3} required />
                    </div>
                    <button className="button secondary">
                      {slug === "corrigir-parcela"
                        ? "SALVAR CORREÇÃO"
                        : "ESTORNAR"}
                    </button>
                  </>
                )}
              </form>
            ))
          ) : (
            <p className="muted">Nenhum pagamento registrado.</p>
          )}
        </section>
      ) : needsPeople ? (
        <section className="section list">
          {slug === "relatorio-inadimplentes" && (
            <div className="actions">
              <a
                className="button secondary"
                href={`/api/admin/report?pool=${pool.id}&format=csv`}
              >
                BAIXAR CSV
              </a>
              <a
                className="button secondary"
                href={`/api/admin/report?pool=${pool.id}&format=pdf`}
              >
                BAIXAR PDF
              </a>
            </div>
          )}
          {peopleRows.length ? (
            peopleRows.map((p) => {
              const due = Math.max(0, p.total - p.received);
              const message = encodeURIComponent(
                `Olá, ${p.name}! No bolão ${pool.title}, recebemos ${money(p.received)} e ainda faltam ${money(due)} para quitar sua participação.`,
              );
              const phone = String(p.phone || "").replace(/\D/g, "");
              return (
                <div className="card" key={p.id}>
                  <strong>{p.name}</strong>
                  <span>
                    Pago: {money(p.received)} · Falta: {money(due)}
                  </span>
                  {phone && (
                    <a
                      className="button secondary"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}?text=${message}`}
                    >
                      ABRIR WHATSAPP
                    </a>
                  )}
                </div>
              );
            })
          ) : (
            <p className="muted">Nenhum participante nesta situação.</p>
          )}
        </section>
      ) : slug === "distribuir-premios" ? (
        <>
          <section className="section card">
            <form className="form" action={createPrizeDistribution}>
              <input type="hidden" name="poolId" value={pool.id} />
              <div className="field">
                <label>Valor total do prêmio (R$)</label>
                <input name="amount" inputMode="decimal" required />
              </div>
              <div className="field">
                <label>Descrição</label>
                <input
                  name="description"
                  placeholder="Ex.: prêmio do concurso"
                />
              </div>
              <button className="button primary">CALCULAR E DISTRIBUIR</button>
            </form>
          </section>
          <section className="section list">
            {moduleRows.map((r) => (
              <div className="card" key={r.id}>
                <strong>{r.participants?.name}</strong>
                <span>
                  {money(Number(r.amount_cents))} · {r.destination}
                </span>
              </div>
            ))}
          </section>
        </>
      ) : slug === "creditar-premio" ? (
        <section className="section">
          <p className="muted">
            Os valores de prêmio calculados aparecem abaixo. A conversão
            definitiva em saldo será feita somente após sua confirmação.
          </p>
          <div className="list">
            {moduleRows.length ? (
              moduleRows.map((r) => (
                <div className="card" key={r.id}>
                  <strong>{r.participants?.name}</strong>
                  <span>
                    {money(Number(r.amount_cents))} · {r.destination}
                  </span>
                  {r.destination === "pending" && (
                    <div className="actions">
                      <form action={creditPrize}>
                        <input type="hidden" name="poolId" value={pool.id} />
                        <input type="hidden" name="allocationId" value={r.id} />
                        <button className="button secondary">
                          CONVERTER EM CRÉDITO
                        </button>
                      </form>
                      <form action={markPrizePixPaid}>
                        <input type="hidden" name="poolId" value={pool.id} />
                        <input type="hidden" name="allocationId" value={r.id} />
                        <button className="button secondary">
                          MARCAR PIX PAGO
                        </button>
                      </form>
                    </div>
                  )}
                  {r.paid_at && (
                    <span>
                      Finalizado em{" "}
                      {new Date(r.paid_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p>Nenhum prêmio distribuído.</p>
            )}
          </div>
          <Link
            className="button secondary"
            href={`/carteira/creditos?pool=${pool.id}`}
          >
            ABRIR CRÉDITOS
          </Link>
        </section>
      ) : slug === "documentos-legais" ? (
        <section className="section list">
          {["privacy", "terms", "lgpd"].map((kind) => {
            const doc = moduleRows.find((r) => r.kind === kind);
            return (
              <form className="card form" action={saveLegalDocument} key={kind}>
                <input type="hidden" name="poolId" value={pool.id} />
                <input type="hidden" name="kind" value={kind} />
                <div className="field">
                  <label>Título</label>
                  <input
                    name="title"
                    defaultValue={
                      doc?.title ||
                      (
                        {
                          privacy: "Política de Privacidade",
                          terms: "Termos de Uso",
                          lgpd: "Direitos LGPD",
                        } as any
                      )[kind]
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label>Conteúdo</label>
                  <textarea
                    name="content"
                    defaultValue={doc?.content || ""}
                    rows={8}
                    required
                  />
                </div>
                <button className="button secondary">SALVAR DOCUMENTO</button>
              </form>
            );
          })}
        </section>
      ) : slug === "painel-erros" ? (
        <section className="section list">
          {moduleRows.length ? (
            moduleRows.map((r) => (
              <form className="card" action={resolveAppError} key={r.id}>
                <input type="hidden" name="poolId" value={pool.id} />
                <input type="hidden" name="errorId" value={r.id} />
                <strong>{r.source}</strong>
                <span>{r.message}</span>
                <span>
                  {new Date(r.created_at).toLocaleString("pt-BR")} ·{" "}
                  {r.resolved_at ? "Resolvido" : "Pendente"}
                </span>
                {!r.resolved_at && (
                  <button className="button secondary">
                    MARCAR COMO RESOLVIDO
                  </button>
                )}
              </form>
            ))
          ) : (
            <p className="status">✓ Nenhum erro registrado.</p>
          )}
        </section>
      ) : slug === "backup" ? (
        <section className="section card">
          <strong>Backup protegido</strong>
          <span>
            Baixe uma cópia dos participantes, pagamentos, carteira, jogos e
            histórico de auditoria deste bolão.
          </span>
          <a
            className="button primary"
            href={`/api/admin/backup?pool=${pool.id}`}
          >
            BAIXAR BACKUP AGORA
          </a>
          <span className="muted">
            A restauração recupera somente registros ausentes e não apaga nem
            substitui os dados atuais.
          </span>
          <BackupRestoreForm poolId={pool.id} />
        </section>
      ) : (
        <section className="section card">
          <strong>Módulo conectado</strong>
          <span>
            Os dados desta função serão carregados automaticamente para o bolão
            selecionado.
          </span>
        </section>
      )}
      <AppNav />
    </main>
  );
}
