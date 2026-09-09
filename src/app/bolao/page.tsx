import Link from "next/link";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);

export default async function PublicPools(){
 const s=createAdminClient();
 const {data}=await s.from("pools").select("id,title,lottery,public_slug,total_shares,share_price_cents,payment_deadline,status,created_at").eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false});
 const now=Date.now();
 const pools=(data??[]).filter(p=>!p.payment_deadline||new Date(p.payment_deadline).getTime()>=now);
 if(pools.length===1)redirect(`/bolao/${pools[0].public_slug}`);
 return <main className="shell"><section className="section"><p className="eyebrow">BOLÃO AMIGOS BTP</p><h1>🍀 Bolões disponíveis</h1><p className="muted">{pools.length>1?"Escolha o bolão que deseja conhecer e participar.":"No momento não há bolões abertos para participação."}</p></section>{pools.length>1&&<section className="section list">{pools.map(p=><Link key={p.id} className="list-item" href={`/bolao/${p.public_slug}`}><div><strong>{p.title}</strong><div className="muted">{p.lottery} · {money(Number(p.share_price_cents))} por cota</div></div><span className="button primary">PARTICIPAR</span></Link>)}</section>}</main>;
}
