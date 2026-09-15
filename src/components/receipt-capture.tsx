"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  notifyGameReceiptBatch,
  uploadGameReceiptFile,
} from "@/app/actions/game-receipts";

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp";

export function ReceiptCapture({ poolId }: { poolId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const selectFiles = (selected: File[], other: HTMLInputElement | null) => {
    if (other) other.value = "";
    setFiles(selected);
    setPreviews(selected.map((file) => URL.createObjectURL(file)));
    setState("idle");
    setProgress(0);
  };

  const publish = async (form: FormData) => {
    if (!files.length || state === "sending") return;
    setState("sending");
    setProgress(0);
    try {
      const title = String(form.get("title") ?? "");
      const receiptIds: string[] = [];
      let failed = 0;
      for (let index = 0; index < files.length; index++) {
        const item = new FormData();
        item.set("poolId", poolId);
        item.set("title", title);
        item.set("receipt", files[index]);
        try {
          receiptIds.push((await uploadGameReceiptFile(item)).id);
        } catch {
          failed++;
        }
        setProgress(index + 1);
      }
      if (!receiptIds.length) throw new Error("Nenhuma imagem foi publicada.");
      const push = await notifyGameReceiptBatch({ poolId, receiptIds, title });
      router.push(
        `/jogos/comprovantes?pool=${encodeURIComponent(poolId)}&published=${receiptIds.length}&failed=${failed}&notified=${push.sent}`,
      );
      router.refresh();
    } catch {
      setState("error");
    }
  };

  return (
    <form className="form" action={publish}>
      <div className="field">
        <label>Título</label>
        <input name="title" defaultValue="Comprovante - " required />
      </div>
      <div className="receipt-guide">
        <strong>Adicionar comprovantes inteiros</strong>
        <span>
          Fotografe um comprovante ou selecione várias imagens salvas no
          celular.
        </span>
      </div>
      <div className="actions" style={{ marginTop: "12px" }}>
        <label className="button primary receipt-camera">
          Abrir câmera
          <input
            ref={cameraInput}
            type="file"
            accept={ACCEPTED_IMAGES}
            capture="environment"
            disabled={state === "sending"}
            onChange={(event) =>
              selectFiles(
                event.target.files ? Array.from(event.target.files) : [],
                galleryInput.current,
              )
            }
          />
        </label>
        <label className="button secondary receipt-camera">
          Selecionar várias imagens
          <input
            ref={galleryInput}
            type="file"
            accept={ACCEPTED_IMAGES}
            multiple
            disabled={state === "sending"}
            onChange={(event) =>
              selectFiles(
                event.target.files ? Array.from(event.target.files) : [],
                cameraInput.current,
              )
            }
          />
        </label>
      </div>
      {!!files.length && (
        <div className="receipt-single-preview">
          <strong>{files.length} imagem(ns) selecionada(s)</strong>
          {previews.map((preview, index) => (
            <img
              key={preview}
              src={preview}
              alt={`Prévia do comprovante ${index + 1}`}
            />
          ))}
          <span>
            Confira se todos os comprovantes estão completos e legíveis.
          </span>
        </div>
      )}
      {state === "sending" && (
        <p className="status">
          Publicando {progress} de {files.length}...
        </p>
      )}
      {state === "error" && (
        <p className="status">Não foi possível concluir. Tente novamente.</p>
      )}
      <p className="receipt-capture-note">
        As imagens são enviadas uma por vez para proteger a memória do celular,
        mas você só precisa apertar o botão uma vez.
      </p>
      <button
        className="button primary"
        disabled={!files.length || state === "sending"}
      >
        {state === "sending"
          ? "Publicando..."
          : "Publicar para os participantes"}
      </button>
    </form>
  );
}
