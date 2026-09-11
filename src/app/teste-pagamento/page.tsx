import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { CopyTestParticipantLink } from "@/components/copy-test-participant-link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TestPayment() {
  const s = await createClient(),
    { data: auth } = await s.auth.getUser();
  if (!auth.user)
    return (
      <main className="shell">
        <section className="section">
          <h1>Teste InfinitePay</h1>
          <p>Entre como organizador para continuar.</p>
          <Link className="button primary" href="/login">
            Entrar
          </Link>
        </section>
      </main>
    );
  const { data: pools } = await s
    .from("pools")
    .select("id,title,lottery,test_access_token")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });
  return (
    <main className="shell">
      <Link className="back" href="/">
        ← Voltar
      </Link>
      <section className="section">
        <p className="eyebrow">MODO DE TESTE</p>
        <h1>🧪 Testar como participante</h1>
        <p className="muted">
          Copie o link e abra-o como um participante. Você fará o cadastro,
          aceitará as regras, passará pela identificação e pagará R$ 1,00, mesmo
          com o temporizador fechado.
        </p>
      </section>
      <section className="section list">
        {!pools?.length ? (
          <p className="muted">Crie um bolão antes de iniciar o teste.</p>
        ) : (
          pools.map((pool) => (
            <div className="card test-payment-pool" key={pool.id}>
              <strong>{pool.title}</strong>
              <span>{pool.lottery}</span>
              {pool.test_access_token ? (
                <CopyTestParticipantLink token={pool.test_access_token} />
              ) : (
                <span className="status">
                  Execute a atualização 0022 do banco para liberar este link.
                </span>
              )}
            </div>
          ))
        )}
      </section>
      <AppNav />
    </main>
  );
}
