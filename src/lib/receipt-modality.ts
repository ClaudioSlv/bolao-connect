const MODALITIES = [
  { label: "+Milionária", terms: ["+milionaria", "mais milionaria"] },
  { label: "Mega-Sena", terms: ["mega-sena", "mega sena", "mega da virada"] },
  { label: "Lotofácil", terms: ["lotofacil"] },
  { label: "Quina", terms: ["quina"] },
  { label: "Dupla Sena", terms: ["dupla sena", "dupla-sena"] },
  { label: "Lotomania", terms: ["lotomania"] },
  { label: "Timemania", terms: ["timemania"] },
  { label: "Dia de Sorte", terms: ["dia de sorte"] },
  { label: "Super Sete", terms: ["super sete", "super-sete"] },
];

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function receiptModality(title: string) {
  const normalized = searchable(title);
  return (
    MODALITIES.find(({ terms }) =>
      terms.some((term) => normalized.includes(term)),
    )?.label ?? "Outros comprovantes"
  );
}

export function groupReceiptsByModality<T extends { title: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const modality = receiptModality(item.title);
    groups.set(modality, [...(groups.get(modality) ?? []), item]);
  }
  return [...groups.entries()];
}
