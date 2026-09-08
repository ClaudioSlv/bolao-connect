import Link from "next/link";
import {AppNav} from "@/components/app-nav";
import {PoolSwitcher} from "@/components/pool-switcher";
import {createClient} from "@/lib/supabase/server";

export const dynamic="force-dynamic";
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
type Pool={id:string;title:string;lottery:string;total_shares:number;share_price_cents:number;public_slug:string|null;status:string};

export default async function Home({searchParams}:{searchParams:Promise<{pool?:string}>}){
  const {pool:requested}=await searchParams;
  const s=await createClient();
  const {data:auth}=await s.auth.getUser();

  if(!auth.user){
    return <main className="shell">
      <div className="brand"><strong>🍀 Bolão Connect</strong><span className="badge">Online</span></div>
      <section className="hero">
        <h1>Entre no seu bolão pelo link enviado pelo organizador.</h1>
        <p className="muted">O participante não cria bolão. Abra o link recebido, confira as informações e toque em “Entrar no Bolão” para confirmar sua participação.</p>
      </section>
      <section className="section">
        <h2>Área do organizador</h2>
        <p className="muted">A criação e administração dos bolões fica em uma área separada.</p>
        <Link className="button secondary" href="/login">Entrar como organizador</Link>
      </section>
    </main>;
  }

  let pools:Pool[]=[],paid=0,pending=0,collected=0;
  const {data}=await s.from("pools").select("id,title,lottery,total_shares,share_price_cents,public_slug,status").eq("owner_id",auth.user.id).order("created_at",{ascending:false});
  pools=(data??[]) as Pool[];
  const pool=pools.find(p=>p.id===requested)??pools[0]??null;

  if(pool){
    const [{data:parts},{data:wallet}]=await Promise.all([
      s.from("participants").select("shares,payment_status,status").eq("pool_id",pool.id),
      s.from("wallet_transactions").select("amount_cents").eq("pool_id",pool.id),
    ]);
    for(const p of parts??[]){
      if(p.status==="cancelled")continue;
      const n=Number(p.shares)||0;
      p.payment_status==="confirmed"?paid+=n:pending+=n;
    }
    collected=(wallet??[]).reduce((a,x)=>a+Number(x.amount_cents||0),0);
  }

  const total=pool?pool.total_shares*pool.share_price_cents:0;
  const progress=total?Math.min(100,Math.round(collected/total*100)):0;
  const q=pool?`?pool=${encodeURIComponent(pool.id)}`:"";

  return <main className="shell">
    <div className="brand"><strong>🍀 Bolão Connect</strong><span className="badge">Organizador</span></div>
    <section className="hero">
      <h1>Painel do organizador</h1>
      <p className="muted">Crie o bolão, compartilhe o link e acompanhe automaticamente participantes, pagamentos, carteira e jogos.</p>
      <div className="actions"><Link className="button primary" href="/criar-bolao">+ Criar bolão</Link><Link className="button secondary" href="/meu-jogo">🎲 Fazer meu próprio jogo</Link></div>
    </section>

    {pools.length>0&&<section className="section"><h2>Meus bolões</h2><PoolSwitcher pools={pools} activeId={pool?.id} basePath="/"/><div className="list">{pools.map(p=><Link key={p.id} className="list-item" href={`/?pool=${p.id}`}><div><strong>{p.title}</strong><div className="muted">{p.lottery}</div></div><span className="status">{p.status}</span></Link>)}</div></section>}

    <section className="section"><h2>Gerenciar {pool?pool.title:"bolão"}</h2><div className="grid"><Link className="card" href={`/carteira${q}`}><strong>💰 Carteira</strong><span>Arrecadação transparente</span></Link><Link className="card" href={`/jogos${q}`}><strong>🎟️ Jogos</strong><span>Apostas e comprovantes</span></Link><Link className="card" href={`/conferencia${q}`}><strong>✅ Conferência</strong><span>Resultados e acertos</span></Link><Link className="card" href={`/participantes${q}`}><strong>👥 Participantes</strong><span>Lista atualizada automaticamente</span></Link><Link className="card" href="/meu-jogo"><strong>🎲 Meu Jogo</strong><span>Escolha números ou gere combinações</span></Link>{pool?.public_slug?<Link className="card" href={`/bolao/${pool.public_slug}`}><strong>🔗 Link do bolão</strong><span>Compartilhar com participantes</span></Link>:null}</div></section>

    <section className="section"><h2>{pool?pool.title:"Resumo"}</h2>{pool?<div className="wallet"><div className="wallet-row"><strong>Arrecadado</strong><strong>{money(collected)}</strong></div><div className="progress"><div style={{width:`${progress}%`}}/></div><div className="wallet-row"><span>{paid} cotas pagas</span><span>{pending} pendentes</span></div><small>Meta: {money(total)} · {progress}% arrecadado</small></div>:<p className="muted">Você ainda não criou um bolão.</p>}</section>
    <AppNav/>
  </main>;
}
