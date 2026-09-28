"use client";

import { useEffect } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const clean = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function makePdf(title: string, lines: string[]) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoResponse = await fetch("/juntasorte-pdf-header.jpg");
  if (!logoResponse.ok) throw new Error("logo");
  const logo = await document.embedJpg(await logoResponse.arrayBuffer());
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const logoWidth = pageWidth - margin * 2;
  const logoHeight = logoWidth * (logo.height / logo.width);
  const rowsPerPage = 20;
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += rowsPerPage) {
    pages.push(lines.slice(index, index + rowsPerPage));
  }
  if (!pages.length) pages.push([]);

  pages.forEach((rows, pageIndex) => {
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(0.025, 0.065, 0.04),
    });
    page.drawImage(logo, {
      x: margin,
      y: pageHeight - margin - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });

    const headingY = pageHeight - margin - logoHeight - 30;
    page.drawText(clean(title) || "Jogos gerados", {
      x: margin,
      y: headingY,
      size: 17,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(
      `JuntaSorte - Bolao entre Amigos - ${clean(new Date().toLocaleString("pt-BR"))}`,
      {
        x: margin,
        y: headingY - 22,
        size: 9,
        font: regular,
        color: rgb(0.78, 0.82, 0.79),
      },
    );

    rows.forEach((row, rowIndex) => {
      const y = headingY - 58 - rowIndex * 25;
      page.drawRectangle({
        x: margin,
        y: y - 7,
        width: logoWidth,
        height: 22,
        borderColor: rgb(0.89, 0.67, 0.08),
        borderWidth: 0.8,
        color: rowIndex % 2 ? rgb(0.035, 0.1, 0.06) : rgb(0.045, 0.13, 0.075),
      });
      page.drawText(clean(row), {
        x: margin + 10,
        y,
        size: 10.5,
        font: regular,
        color: rgb(1, 1, 1),
      });
    });

    page.drawText(`Pagina ${pageIndex + 1} de ${pages.length}`, {
      x: pageWidth - margin - 72,
      y: 20,
      size: 8,
      font: regular,
      color: rgb(0.65, 0.7, 0.66),
    });
  });

  document.setTitle(clean(title) || "Jogos JuntaSorte");
  document.setAuthor("JuntaSorte - Bolao entre Amigos");
  const bytes = await document.save();
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

export function PdfGameShare() {
  useEffect(() => {
    const handler = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement)?.closest("button");
      if (!button || !button.textContent?.includes("COMPARTILHAR JOGO")) return;

      const area = document.getElementById("generated-games");
      if (!area) return;
      const rows = [...area.querySelectorAll(".list-item")].map((element, index) => {
        const reference = Number((element as HTMLElement).dataset.gameReference) || index + 1;
        const text = (element.textContent || "").replace(/^Jogo\s*\d+/i, "").trim();
        return `Jogo ${reference}: ${text}`;
      });
      if (!rows.length) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        const heading = document.querySelector("main h1")?.textContent || "Jogos gerados";
        const blob = await makePdf(heading, rows);
        const file = new File([blob], `juntasorte-jogos-${Date.now()}.pdf`, {
          type: "application/pdf",
        });

        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({
            title: "JuntaSorte - Jogos",
            text: "Meus jogos gerados no JuntaSorte - Bolao entre Amigos.",
            files: [file],
          });
          return;
        }

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        alert("O PDF foi criado. Neste aparelho, envie o arquivo baixado pelo WhatsApp.");
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          alert("Nao foi possivel compartilhar o PDF neste aparelho.");
        }
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
