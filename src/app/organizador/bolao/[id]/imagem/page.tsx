import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { removePoolCoverImage, setPoolCoverImage } from "@/app/actions/pools";

async function saveCover(form: FormData) {
  "use server";
  const poolId = String(form.get("poolId") ?? "");
  const file = form.get("coverImage");
  if (!(file instanceof File) || file.size < 1)
    throw new Error("Escolha uma imagem para o bolão.");
  await setPoolCoverImage(poolId, file);
  redirect(`/organizador/bolao/${poolId}/imagem?saved=1`);
}

async function removeCover(form: FormData) {
  "use server";
  const poolId = String(form.get("poolId") ?? "");
  await removePoolCoverImage(poolId);
  redirect(`/organizador/bolao/${poolId}/imagem?removed=1`);
}

export default async function PoolImagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; removed?: string }>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const s = await createClient();
  const { data: auth } = await s.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: pool } = await s
    .from("pools")
    .select("id,title,cover_image_url")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!pool) redirect("/");

  return (
    <main className="shell">
      <Link className="back" href={`/?pool=${pool.id}`}>← Voltar</Link>
      <section className="section">
        <p className="eyebrow">IMAGEM DO BOLÃO</p>
        <h1>{pool.title}</h1>
        <p className="muted">Escolha uma imagem horizontal para aparecer no painel, no temporizador e na página pública.</p>
        {notice.saved && <p className="status">✓ Imagem salva com sucesso.</p>}
        {notice.removed && <p className="status">✓ Imagem removida.</p>}
        {pool.cover_image_url && (
          <img src={pool.cover_image_url} alt={`Capa de ${pool.title}`} style={{width:"100%",aspectRatio:"3 / 1",objectFit:"cover",borderRadius:20,border:"1px solid #f7c948"}} />
        )}
        <form className="form" action={saveCover}>
          <input type="hidden" name="poolId" value={pool.id} />
          <div className="field">
            <label>{pool.cover_image_url ? "Trocar imagem" : "Escolher imagem"}</label>
            <input name="coverImage" type="file" accept="image/jpeg,image/png,image/webp" required />
            <small>JPG, PNG ou WebP, até 5 MB.</small>
          </div>
          <button className="button primary">SALVAR IMAGEM</button>
        </form>
        {pool.cover_image_url && (
          <form action={removeCover}>
            <input type="hidden" name="poolId" value={pool.id} />
            <button className="button secondary">REMOVER IMAGEM</button>
          </form>
        )}
      </section>
    </main>
  );
}
