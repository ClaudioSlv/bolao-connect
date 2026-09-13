import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { adminMenu } from "@/lib/admin-menu";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await createClient(),
    { data: a } = await s.auth.getUser();
  if (!a.user)
    return (
      <main className="shell">
        <section className="section">
          <h1>Menu</h1>
          <p>Entre na conta do organizador.</p>
        </section>
      </main>
    );
  const categories = [...new Set(adminMenu.map((x) => x.category))];
  return (
    <main className="shell">
      <Link className="back" href="/">
        ← Voltar
      </Link>
      <section className="section">
        <p className="eyebrow">PAINEL DO ORGANIZADOR</p>
        <h1>☰ Menu</h1>
        <p className="muted">Cada função abre uma tela específica.</p>
        <Link className="button secondary" href="/teste-pagamento">
          🧪 Testar PagBank
        </Link>
      </section>
      {categories.map((category) => (
        <section className="section" key={category}>
          <h2>{category}</h2>
          <div className="list">
            {adminMenu
              .filter((x) => x.category === category)
              .map((x) => (
                <Link className="card" href={x.href} key={x.slug}>
                  <strong>
                    {x.icon} {x.title}
                  </strong>
                  <span>Abrir função →</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
      <AppNav />
    </main>
  );
}
