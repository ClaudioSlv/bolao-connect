import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReceiptViewer } from "@/components/receipt-viewer";
import { groupReceiptsByModality } from "@/lib/receipt-modality";
export const dynamic = "force-dynamic";
export default async function ParticipantReceipts({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params,
    s = createAdminClient(),
    activeSince = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    { data: participant } = await s
      .from("participants")
      .select("pool_id,status")
      .eq("access_token", token)
      .maybeSingle();
  if (!participant || participant.status === "cancelled")
    return (
      <main className="shell">
        <h1>Link inválido</h1>
      </main>
    );
  const { data: pool } = await s
      .from("pools")
      .select("title,lottery,contest_number")
      .eq("id", participant.pool_id)
      .single(),
    { data: receipts } = await s
      .from("game_receipts")
      .select("id,title,storage_path,published_at")
      .eq("pool_id", participant.pool_id)
      .eq("status", "published")
      .gte("published_at", activeSince)
      .order("published_at", { ascending: false });
  const total = receipts?.length ?? 0,
    ready = await Promise.all(
      (receipts ?? []).map(async (r: any, index: number) => {
        const { data } = await s.storage
          .from("game-receipts")
          .createSignedUrl(r.storage_path, 900);
        return { ...r, reference: total - index, url: data?.signedUrl ?? "" };
      }),
    ),
    groups = groupReceiptsByModality(ready.filter((r) => r.url));
  return (
    <main className="shell receipt-page">
      <Link className="back" href={`/p/${token}`}>
        ← Voltar
      </Link>
      <section className="section">
        <p className="eyebrow">ACESSO DO PARTICIPANTE</p>
        <h1>Bilhetes do bolão</h1>
        <p>
          <strong>{pool?.title}</strong>
        </p>
        <p className="muted">
          {pool?.lottery}
          {pool?.contest_number ? ` · Concurso ${pool.contest_number}` : ""}
        </p>
        <p className="muted">
          Os bilhetes ficam disponíveis ao participante por 36 horas após a publicação.
        </p>
      </section>
      <section className="section">
        {!groups.length ? (
          <div className="card">
            <strong>Nenhum bilhete disponível agora</strong>
            <span>Bilhetes com mais de 36 horas ficam somente no histórico do organizador.</span>
          </div>
        ) : (
          groups.map(([modality, items]) => (
            <section className="section" key={modality}>
              <h2>{modality}</h2>
              {items.map((r: any) => (
                <ReceiptViewer
                  key={r.id}
                  title={`Referência ${String(r.reference).padStart(2, "0")} · ${r.title}`}
                  url={r.url}
                  viewEvent={{ token, receiptId: r.id }}
                />
              ))}
            </section>
          ))
        )}
      </section>
    </main>
  );
}
