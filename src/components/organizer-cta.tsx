import Link from "next/link";

export function OrganizerCta(){
  return <section className="section organizer-cta">
    <h2>🎯 Quer organizar o seu próprio bolão?</h2>
    <p className="muted">Crie sua conta de organizador. Seus bolões, participantes, pagamentos, carteira e jogos ficam separados dos demais organizadores.</p>
    <Link className="button secondary" href="/organizador/cadastro">QUERO CRIAR MEU PRÓPRIO BOLÃO</Link>
  </section>;
}
