"use client";

import { useRef, useState } from "react";

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp";

export function ReceiptCapture() {
  const [preview, setPreview] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const selectFile = (file: File | undefined, other: HTMLInputElement | null) => {
    if (other) other.value = "";
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  return (
    <div className="receipt-capture">
      <div className="receipt-guide">
        <strong>Adicionar comprovante inteiro</strong>
        <span>
          Fotografe agora ou escolha uma imagem que já esteja salva no celular.
        </span>
      </div>
      <div className="actions" style={{ marginTop: "12px" }}>
        <label className="button primary receipt-camera">
          Abrir câmera
          <input
            ref={cameraInput}
            name="receipt"
            type="file"
            accept={ACCEPTED_IMAGES}
            capture="environment"
            onChange={(event) =>
              selectFile(event.target.files?.[0], galleryInput.current)
            }
          />
        </label>
        <label className="button secondary receipt-camera">
          Buscar imagem no celular
          <input
            ref={galleryInput}
            name="receipt"
            type="file"
            accept={ACCEPTED_IMAGES}
            onChange={(event) =>
              selectFile(event.target.files?.[0], cameraInput.current)
            }
          />
        </label>
      </div>
      {preview && (
        <div className="receipt-single-preview">
          <img src={preview} alt="Prévia completa do comprovante" />
          <span>
            Confira se o comprovante inteiro e todas as dezenas estão visíveis.
          </span>
        </div>
      )}
      <p className="receipt-capture-note">
        O participante poderá ampliar com dois dedos e arrastar a imagem em
        qualquer direção.
      </p>
    </div>
  );
}
