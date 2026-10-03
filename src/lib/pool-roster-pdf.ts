import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ClosedRoster = { pool_id: string; title: string; lottery: string; contest_number: number | null; payment_deadline: string; closed_at: string };
export type ClosedRosterEntry = { participant_id: string; name: string; shares: number; recorded_at: string; late_bank_confirmation: boolean; is_organizer_free_share?: boolean };
const text = (v: string) => v.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ").replace(/\s+/g, " ").trim();
const date = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function makePoolRosterPdf(roster: ClosedRoster, entries: ClosedRosterEntry[], hash: string, logoBytes: Uint8Array) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(logoBytes);
  const logoSize = logo.scaleToFit(48, 48);
  const width = 595.28, height = 841.89, margin = 36;
  const wrap = (value: string, size: number, maxWidth: number) => {
    const lines: string[] = []; let row = "";
    for (const word of text(value).split(" ")) {
      // Split long unbroken names too, keeping them inside the page.
      for (const part of word.match(/.{1,45}/g) ?? [word]) {
        const next = row ? `${row} ${part}` : part;
        if (row && regular.widthOfTextAtSize(next, size) > maxWidth) { lines.push(row); row = part; }
        else row = next;
      }
    }
    if (row) lines.push(row);
    return lines;
  };
  let page = pdf.addPage([width, height]), y = 0;
  const header = () => {
    page.drawImage(logo, { x: margin + (48 - logoSize.width) / 2, y: height - 83 + (48 - logoSize.height) / 2, ...logoSize });
    page.drawText("JuntaSorte - Bolão entre Amigos", { x: 96, y: height - 49, font: bold, size: 15 });
    page.drawText("Participantes confirmados", { x: 96, y: height - 70, font: regular, size: 13 });
    y = height - 111;
    for (const line of wrap(roster.title, 12, width - margin * 2)) { page.drawText(line, { x: margin, y, font: bold, size: 12 }); y -= 17; }
    for (const line of [`Modalidade: ${roster.lottery} | Concurso: ${roster.contest_number ?? "não informado"}`, `Prazo final: ${date(roster.payment_deadline)} (Brasília)`, `Fechamento registrado: ${date(roster.closed_at)}`, `${entries.length} participantes | ${entries.filter(p => !p.is_organizer_free_share).reduce((s, p) => s + p.shares, 0)} cotas pagas | ${entries.filter(p => p.is_organizer_free_share).reduce((s, p) => s + p.shares, 0)} gratuitas`]) {
      page.drawText(text(line), { x: margin, y, font: regular, size: 10 }); y -= 16;
    }
    y -= 15;
  };
  header();
  if (!entries.length) { page.drawText("Nenhum participante com cota quitada no fechamento.", { x: margin, y, font: regular, size: 11 }); y -= 25; }
  for (const [i, entry] of entries.entries()) {
    const lines = wrap(`${i + 1}. ${entry.name}`, 11, width - margin * 2 - 80);
    const rowHeight = lines.length * 15 + (entry.late_bank_confirmation ? 16 : 0) + (entry.is_organizer_free_share ? 16 : 0) + 12;
    if (y - rowHeight < 110) { page = pdf.addPage([width, height]); header(); }
    for (const line of lines) { page.drawText(line, { x: margin, y, font: regular, size: 11 }); y -= 15; }
    page.drawText(`${entry.shares} cota(s)`, { x: width - margin - 65, y: y + lines.length * 15, font: bold, size: 10 });
    if (entry.is_organizer_free_share) { page.drawText("Organizador - cota gratuita", { x: margin + 12, y, font: bold, size: 9 }); y -= 16; }
    if (entry.late_bank_confirmation) { page.drawText(`Pix pago no prazo; confirmação bancária em ${date(entry.recorded_at)}`, { x: margin + 12, y, font: regular, size: 8 }); y -= 16; }
    page.drawLine({ start: { x: margin, y: y - 1 }, end: { x: width - margin, y: y - 1 }, color: rgb(.8, .8, .8), thickness: .5 });
    y -= 12;
  }
  for (const [i, sheet] of pdf.getPages().entries()) {
    sheet.drawText("Lista protegida contra alterações manuais após o prazo.", { x: margin, y: 77, font: regular, size: 9 });
    sheet.drawText(`Bolão: ${roster.pool_id}`, { x: margin, y: 59, font: regular, size: 8 });
    sheet.drawText(`SHA-256: ${hash}`, { x: margin, y: 43, font: regular, size: 7 });
    sheet.drawText(`Página ${i + 1} de ${pdf.getPageCount()}`, { x: margin, y: 25, font: regular, size: 8 });
  }
  pdf.setTitle(`Participantes confirmados - ${text(roster.title)}`);
  pdf.setAuthor("JuntaSorte");
  return pdf.save();
}
