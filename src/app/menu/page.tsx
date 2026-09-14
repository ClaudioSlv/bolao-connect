import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { BtpIcon } from "@/components/btp-icon";
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
        <h1 className="menu-page-title">
          <BtpIcon name="menu" size={38} />
          <span>Menu</span>
        </h1>
        <p className="muted">Cada função abre uma tela específica.</p>
        <Link className="button secondary menu-test-button" href="/teste-pagamento">
          <BtpIcon name="testar-pagbank" size={27} />
          <span>Testar PagBank</span>
        </Link>
      </section>
      {categories.map((category) => (
        <section className="section" key={category}>
          <h2>{category}</h2>
          <div className="list">
            {adminMenu
              .filter((x) => x.category === category)
              .map((x) => (
                <Link className="card menu-function-card" href={x.href} key={x.slug}>
                  <BtpIcon name={x.slug} size={36} />
                  <span className="menu-function-copy">
                    <strong>{x.title}</strong>
                    <span>Abrir função →</span>
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ))}
      <AppNav />
    </main>
  );
}
