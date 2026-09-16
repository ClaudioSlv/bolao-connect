import Link from "next/link";
import { AppNav } from "@/components/app-nav";

export default function SavedGamesMenuPage() {
  return (
    <main className="shell">
      <Link className="back" href="/">
        ← Voltar
      </Link>

      <section className="section">
        <p className="eyebrow">PAINEL DO ORGANIZADOR</p>
        <h1>Jogos Salvos</h1>
        <p className="muted">
          Consulte seus jogos ou faça uma conferência manual quando o resultado automático ainda não estiver disponível.
        </p>
      </section>

      <section className="section">
        <div className="list">
          <Link className="list-item" href="/meus-jogos-salvos">
            <div>
              <strong>Meus jogos salvos</strong>
              <div className="muted">Histórico e conferência automática dos jogos deste aparelho.</div>
            </div>
            <span className="card-chevron" aria-hidden="true">›</span>
          </Link>

          <Link className="list-item" href="/conferencia-manual">
            <div>
              <strong>Conferir resultado manual</strong>
              <div className="muted">Informe modalidade, concurso e dezenas sorteadas para conferir na hora.</div>
            </div>
            <span className="card-chevron" aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      <AppNav />
    </main>
  );
}
