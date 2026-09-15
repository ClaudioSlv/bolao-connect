import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PoolSwitcher } from "@/components/pool-switcher";
import { ReceiptCapture } from "@/components/receipt-capture";
import { ReceiptViewer } from "@/components/receipt-viewer";
import { groupReceiptsByModality } from "@/lib/receipt-modality";
export const dynamic = "force-dynamic";
export default async function Receipts({
  searchParams,
}: {
  searchParams: Promise<{
    pool?: string;
    published?: string;
    failed?: string;
    notified?: string;
  }>;
}) {
  const { pool: requested, published, failed, notified } = await searchParams,
    s = await createClient(),
    { data: auth } = await s.auth.getUser();
  if (!auth.user)
    return (
      <main className="shell">
        <p>Faça login.</p>
      </main>
    );
  const { data: pools } = await s
    .from("pools")
    .select("id,title,lottery,contest_number")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });
  const active =
      (pools ?? []).find((p) => p.id === requested) ?? pools?.[0] ?? null,
    admin = createAdminClient();
  let receipts: any[] = [];
  if (active) {
    const { data } = await admin
      .from("game_receipts")
      .select("id,title,storage_path,published_at")
      .eq("pool_id", active.id)
      .order("published_at", { ascending: false });
    receipts = data ?? [];
  }
  const ready = await Promise.all(
    receipts.map(async (receipt, index) => {
      const { data } = await admin.storage
        .from("game-receipts")
        .createSignedUrl(receipt.storage_path, 3600);
      return {
        ...receipt,
        reference: receipts.length - index,
        url: data?.signedUrl ?? "",
      };
    }),
  );
  const ids = ready.map((r) => r.id),
    { data: viewEvents } = ids.length
      ? await admin
          .from("audit_events")
          .select("entity_id,created_at,details")
          .eq("event_type", "receipt_viewed")
          .in("entity_id", ids)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };
  const views = new Map<string, any[]>();
  for (const event of viewEvents ?? []) {
    views.set(event.entity_id, [...(views.get(event.entity_id) ?? []), event]);
  }
  const groups = groupReceiptsByModality(ready.filter((r) => r.url));
  return (
    <main className="shell receipt-page">
      <Link
        className="back"
        href={active ? `/jogos?pool=${active.id}` : "/jogos"}
      >
        ← Voltar aos jogos
      </Link>
      <section className="section">
        <h1>Comprovantes dos jogos</h1>
        <p className="muted">
          Fotografe ou escolha uma imagem salva no celular. Publique uma por vez
          e adicione quantos comprovantes precisar.
        </p>
        <PoolSwitcher
          pools={pools ?? []}
          activeId={active?.id}
          basePath="/jogos/comprovantes"
        />
      </section>
      {published && (
        <p className="status">
          ✓ {published} comprovante(s) publicado(s).{" "}
          {Number(failed) > 0
            ? `${failed} imagem(ns) não puderam ser enviadas. `
            : ""}
          {Number(notified) > 0
            ? `${notified} notificação(ões) enviada(s).`
            : "Nenhum participante possui notificação ativa."}{" "}
          Você já pode adicionar o próximo.
        </p>
      )}
      {active && (
        <section className="section card">
          <h2>Novo comprovante</h2>
          <ReceiptCapture poolId={active.id} />
        </section>
      )}
      <section className="section">
        <h2>Já publicados</h2>
        {!groups.length ? (
          <p className="muted">Nenhum comprovante publicado.</p>
        ) : (
          groups.map(([modality, items]) => (
            <section className="section" key={modality}>
              <h2>{modality}</h2>
              {items.map((r) => {
                const seen = views.get(r.id) ?? [];
                return (
                  <div key={r.id}>
                    <ReceiptViewer
                      title={`Referência ${String(r.reference).padStart(2, "0")} · ${r.title}`}
                      url={r.url}
                    />
                    <p
                      className="muted"
                      style={{ fontSize: "12px", margin: "-5px 4px 14px" }}
                    >
                      {seen.length
                        ? `Visualizado por ${seen.map((event) => `${event.details?.participant_name ?? "Participante"} em ${new Date(event.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`).join(" · ")}`
                        : "Ainda não visualizado por nenhum participante."}
                    </p>
                  </div>
                );
              })}
            </section>
          ))
        )}
      </section>
    </main>
  );
}
