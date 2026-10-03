import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

export async function makeGamesPdf(title: string, lines: string[], logoBytes?: Uint8Array) {
  if (!lines.length) throw new Error("Nenhum jogo para compartilhar.");
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoData = logoBytes ?? await (async () => {
    const response = await fetch("/juntasorte-icon-512.png");
    if (!response.ok) throw new Error("Não foi possível carregar a logo do app.");
    return new Uint8Array(await response.arrayBuffer());
  })();
  const logo = await document.embedPng(logoData);
  const modality = clean(title).match(/Mega[- ]Sena|Lotofacil|Quina|Dupla Sena|Lotomania|Timemania|Dia de Sorte|Super Sete|\+Milionaria/i)?.[0] || clean(title).split(" - ")[0];
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
  const cards: { reference: number; lot: number; heading: string; rows: string[] }[] = [];
  for (const [index, line] of lines.entries()) {
    const match = clean(line).match(/^(Jogo\s*\d+):?\s*(.*)$/i);
    const reference = Number(match?.[1].match(/\d+/)?.[0]) || index + 1;
    const lot = Math.floor((reference - 1) / 100) + 1;
    cards.push({ reference, lot, heading: `Jogo ${reference}`, rows: wrap(match?.[2] || line) });
    if (index % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const cardHeight = Math.max(52, ...cards.map(card => 26 + card.rows.length * 11));
  const top = height - 112;
  const rowsPerPage = Math.max(1, Math.floor((top - 88 + gap) / (cardHeight + gap)));
  const perPage = rowsPerPage * columns;
  const lots = new Map<number, typeof cards>();
  for (const card of cards) {
    const group = lots.get(card.lot) ?? [];
    group.push(card);
    lots.set(card.lot, group);
  }
  const sheets: { lot: number; lotPage: number; lotPages: number; cards: typeof cards }[] = [];
  for (const [lot, group] of [...lots].sort(([a], [b]) => a - b)) {
    group.sort((a, b) => a.reference - b.reference);
    const lotPages = Math.ceil(group.length / perPage);
    for (let offset = 0; offset < group.length; offset += perPage)
      sheets.push({ lot, lotPage: Math.floor(offset / perPage) + 1, lotPages, cards: group.slice(offset, offset + perPage) });
  }
  const pages = sheets.length;
  for (const [pageIndex, sheet] of sheets.entries()) {
    const page = document.addPage([width, height]);
    // Repeat a faint app logo behind the games across the entire sheet.
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 3; column++) {
        page.drawImage(logo, { x: 36 + column * 180, y: 92 + row * 180, width: 150, height: 150, opacity: 0.055 });
      }
    }
    page.drawText("JuntaSorte - Bolao entre Amigos", { x: margin, y: height - 32, font: bold, size: 14 });
    page.drawText(clean(title), { x: margin, y: height - 51, font: regular, size: Math.min(11, (width - margin * 2) / Math.max(1, regular.widthOfTextAtSize(clean(title), 1))) });
    page.drawText(`${lines.length.toLocaleString("pt-BR")} jogos | A4`, { x: margin, y: height - 67, font: regular, size: 9 });
    page.drawText(`LOTE ${sheet.lot}`, { x: margin, y: height - 95, font: bold, size: 20 });
    const range = `Jogos ${sheet.cards[0].reference} a ${sheet.cards[sheet.cards.length - 1].reference} | Folha ${sheet.lotPage} de ${sheet.lotPages}`;
    page.drawText(range, { x: width - margin - regular.widthOfTextAtSize(range, 9), y: height - 92, font: regular, size: 9 });
    sheet.cards.forEach((card, index) => {
      const x = margin + (index % columns) * (cardWidth + gap);
      const y = top - Math.floor(index / columns) * (cardHeight + gap) - cardHeight;
      page.drawRectangle({ x, y, width: cardWidth, height: cardHeight, borderWidth: 0.5, borderColor: rgb(.7, .7, .7) });
      page.drawText(card.heading, { x: x + 7, y: y + cardHeight - 13, font: bold, size: 9 });
      card.rows.forEach((row, rowIndex) => page.drawText(row, { x: x + 7, y: y + cardHeight - 27 - rowIndex * 11, font: regular, size }));
    });
    const modalitySize = Math.min(10, 240 / Math.max(1, bold.widthOfTextAtSize(modality, 1)));
    page.drawText(modality, { x: (width - bold.widthOfTextAtSize(modality, modalitySize)) / 2, y: 68, font: bold, size: modalitySize });
    page.drawImage(logo, { x: (width - 42) / 2, y: 18, width: 42, height: 42 });
    page.drawText(`Pagina ${pageIndex + 1} de ${pages} - LOTE ${sheet.lot}`, { x: margin, y: 20, font: regular, size: 8 });
    // Keep the interface responsive for large sets.
    if (pageIndex % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
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
