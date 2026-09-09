import Link from "next/link";

export function OrganizerCta(){
  return <section className="section organizer-cta">
    <h2>🎯 Quer se tornar um Organizador de Bolão?</h2>
    <p className="muted">Crie sua conta e organize seus próprios bolões pelo aplicativo.</p>
    <Link className="button primary" href="/organizador/cadastro">🟡 QUERO SER ORGANIZADOR</Link>
  </section>;
}
