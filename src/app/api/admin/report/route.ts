import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";

const money = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: NextRequest) {
  const poolId = request.nextUrl.searchParams.get("pool"),
    format = request.nextUrl.searchParams.get("format") || "csv";
  if (!poolId)
    return NextResponse.json(
      { error: "Bolão não informado." },
      { status: 400 },
    );
  const s = await createClient();
  const { data: auth } = await s.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { data: pool } = await s
    .from("pools")
    .select("id,title,share_price_cents,owner_id")
    .eq("id", poolId)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!pool)
    return NextResponse.json(
      { error: "Bolão não autorizado." },
      { status: 403 },
    );
  const [{ data: participants }, { data: payments }] = await Promise.all([
    s
      .from("participants")
      .select("id,name,phone,shares,status,payment_status")
      .eq("pool_id", poolId)
      .order("name"),
    s
      .from("payments")
      .select(
        "id,participant_id,amount_cents,credit_used_cents,status,payment_method,created_at",
      )
      .eq("pool_id", poolId)
      .order("created_at"),
  ]);
  const paid = new Map<string, number>();
  for (const p of payments ?? [])
    if (["partial", "confirmed"].includes(p.status))
      paid.set(
        p.participant_id,
        (paid.get(p.participant_id) || 0) +
          Number(p.amount_cents || 0) +
          Number(p.credit_used_cents || 0),
      );
  const rows = (participants ?? []).map((p) => {
    const total = Number(p.shares) * Number(pool.share_price_cents),
      received = paid.get(p.id) || 0;
    return { ...p, total, received, due: Math.max(0, total - received) };
  });
  const safeTitle = pool.title.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  if (format === "csv") {
    const csv = [
      "Participante;WhatsApp;Cotas;Total;Pago;Falta;Situação",
      ...rows.map((r) =>
        [
          r.name,
          r.phone,
          r.shares,
          money(r.total),
          money(r.received),
          money(r.due),
          r.payment_status,
        ]
          .map(csvCell)
          .join(";"),
      ),
    ].join("\n");
    return new NextResponse(`\ufeff${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="relatorio-${safeTitle}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]),
    y = 800;
  const draw = (text: string, size = 10, isBold = false) => {
    if (y < 45) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text, {
      x: 42,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.08, 0.15, 0.1),
    });
    y -= size + 7;
  };
  draw("Bolão Amigos BTP", 18, true);
  draw(`Relatório financeiro - ${pool.title}`, 14, true);
  draw(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 9);
  y -= 8;
  for (const r of rows) {
    draw(`${r.name} | ${r.shares} cota(s) | ${r.payment_status}`, 10, true);
    draw(
      `Total: ${money(r.total)}   Pago: ${money(r.received)}   Falta: ${money(r.due)}`,
      9,
    );
    y -= 5;
  }
  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="relatorio-${safeTitle}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
