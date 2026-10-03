import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

export async function makeGamesPdf(title: string, lines: string[]) {
  if (!lines.length) throw new Error("Nenhum jogo para compartilhar.");
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28, height = 841.89, margin = 28, gap = 8, columns = 3;
  const cardWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  const size = 8.5;
  const wrap = (text: string) => {
    const rows: string[] = [];
    let row = "";
    for (const word of clean(text).split(" ")) {
      const next = row ? `${row} ${word}` : word;
      if (row && regular.widthOfTextAtSize(next, size) > cardWidth - 14) { rows.push(row); row = word; }
      else row = next;
    }
    if (row) rows.push(row);
    return rows;
  };
  const cards = lines.map((line, index) => {
    const match = clean(line).match(/^(Jogo\s*\d+):?\s*(.*)$/i);
    return { heading: match?.[1] || `Jogo ${index + 1}`, rows: wrap(match?.[2] || line) };
  });
  const cardHeight = Math.max(52, ...cards.map(card => 26 + card.rows.length * 11));
  const top = height - 88;
  const rowsPerPage = Math.max(1, Math.floor((top - 40 + gap) / (cardHeight + gap)));
  const perPage = rowsPerPage * columns;
  const pages = Math.ceil(cards.length / perPage);
  for (let offset = 0; offset < cards.length; offset += perPage) {
    const page = document.addPage([width, height]);
    page.drawText("JuntaSorte - Bolao entre Amigos", { x: margin, y: height - 32, font: bold, size: 14 });
    page.drawText(clean(title), { x: margin, y: height - 51, font: regular, size: Math.min(11, (width - margin * 2) / Math.max(1, regular.widthOfTextAtSize(clean(title), 1))) });
    page.drawText(`${lines.length.toLocaleString("pt-BR")} jogos | A4`, { x: margin, y: height - 67, font: regular, size: 9 });
    cards.slice(offset, offset + perPage).forEach((card, index) => {
      const x = margin + (index % columns) * (cardWidth + gap);
      const y = top - Math.floor(index / columns) * (cardHeight + gap) - cardHeight;
      page.drawRectangle({ x, y, width: cardWidth, height: cardHeight, borderWidth: 0.5, borderColor: rgb(.7, .7, .7) });
      page.drawText(card.heading, { x: x + 7, y: y + cardHeight - 13, font: bold, size: 9 });
      card.rows.forEach((row, rowIndex) => page.drawText(row, { x: x + 7, y: y + cardHeight - 27 - rowIndex * 11, font: regular, size }));
    });
    page.drawText(`Pagina ${Math.floor(offset / perPage) + 1} de ${pages}`, { x: margin, y: 20, font: regular, size: 8 });
    // Keep the interface responsive for large sets.
    if (offset % (perPage * 5) === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  document.setTitle(clean(title));
  document.setAuthor("JuntaSorte - Bolao entre Amigos");
  return document.save();
}

export async function shareGamesPdf(title: string, lines: string[]) {
  const bytes = await makeGamesPdf(title, lines);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const file = new File([buffer], `juntasorte-jogos-${Date.now()}.pdf`, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return;
  }
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  alert("PDF baixado. Você pode compartilhar ou imprimir o arquivo em A4.");
}
