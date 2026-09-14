type Props = { name: string; size?: number; className?: string };

export function BtpIcon({ name, size = 32, className = "" }: Props) {
  const glyph = (() => {
    switch (name) {
      case "menu": return <><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 8h8M8 12h8M8 16h8"/><circle className="btp-icon-accent" cx="5" cy="8" r=".7"/><circle className="btp-icon-accent" cx="5" cy="12" r=".7"/><circle className="btp-icon-accent" cx="5" cy="16" r=".7"/></>;
      case "conta-recebimento": return <><path d="M3.5 7.5h14a3 3 0 0 1 3 3v8h-17z"/><path d="M3.5 7.5 16 4.5v3M15 12h6v4h-6a2 2 0 0 1 0-4Z"/><path className="btp-icon-accent" d="m18.2 18.7 2.3 2.3 2.3-2.3-2.3-2.3z"/></>;
      case "homologacao-pagbank":
      case "testar-pagbank": return <><path d="M12 3.2 20 6v5.8c0 4.7-3.1 7.5-8 9.2-4.9-1.7-8-4.5-8-9.2V6z"/><path className="btp-icon-accent" d="m8 12 2.5 2.5 5.5-6"/><circle className="btp-icon-accent" cx="21" cy="8" r="1"/><circle className="btp-icon-accent" cx="21" cy="13" r="1"/></>;
      case "pesquisar-participantes": return <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.2 15.2 5.2 5.2"/><circle className="btp-icon-accent" cx="10.5" cy="8.8" r="2"/><path className="btp-icon-accent" d="M7.2 14c.7-2 2-3 3.3-3s2.6 1 3.3 3"/></>;
      case "filtrar-participantes": return <><circle cx="7" cy="7" r="2"/><circle cx="12" cy="5.5" r="2"/><circle cx="17" cy="7" r="2"/><path d="M3.5 11c1.4-2 3-2.5 4.7-1.4M20.5 11c-1.4-2-3-2.5-4.7-1.4M8.5 9.5c1-1.6 2.2-2 3.5-2s2.5.4 3.5 2"/><path className="btp-icon-accent" d="M5 12h14l-5.2 5.5V22l-3.6-1.8v-2.7z"/></>;
      case "editar-participante": return <><rect x="3" y="5" width="15" height="14" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5.5 16c.5-2 1.4-3 2.5-3s2 .9 2.5 3M12.5 9H16"/><path className="btp-icon-accent" d="m14 19 5.8-5.8 2 2L16 21l-3 .8z"/></>;
      case "corrigir-parcela": return <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 9h5M6 12h3M17.5 9.2v5.6"/><path className="btp-icon-accent" d="m15.3 11.3 2.2-2.1 2.2 2.1M19.7 12.7l-2.2 2.1-2.2-2.1"/></>;
      case "estornar-pagamento": return <><circle cx="13" cy="12" r="7"/><path className="btp-icon-accent" d="M10 9H6V5M6.4 9A7 7 0 1 1 7 16"/><path d="M13 8v8M10.8 10h3.3a1.5 1.5 0 0 1 0 3h-2.2a1.5 1.5 0 0 0 0 3h3.3"/></>;
      case "historico-parcelas": return <><path d="M6 3.5h12v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2z"/><path d="M9 8h6M9 11h6M9 14h3"/><path className="btp-icon-accent" d="M4.5 9.5A8 8 0 0 0 4 12c0 2.4 1 4.5 2.6 6M4.5 9.5V6m0 3.5H8"/></>;
      case "relatorio-inadimplentes": return <><path d="M4 20V10h4v10M10 20V5h4v15M16 20v-7h4v7M3 20.5h18"/><path className="btp-icon-accent" d="M18 4v4M18 10h.01"/></>;
      case "distribuir-premios": return <><path d="M8 4h8v3c0 4-1.5 6-4 7-2.5-1-4-3-4-7zM9 20h6M12 14v6M8 6H4c0 4 1.5 6 5 6M16 6h4c0 4-1.5 6-5 6"/><path className="btp-icon-accent" d="M5 17h3M16 17h3M6.5 15.5v3M17.5 15.5v3"/></>;
      case "creditar-premio": return <><path d="M3.5 8h17v11h-17zM3.5 11h17M7 16h3"/><path className="btp-icon-accent" d="M12 4h6v4M18 4l-6 6"/></>;
      case "mensagens-cobranca": return <><path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5"/><path className="btp-icon-accent" d="M17.5 17.5v4M15.5 19.5h4"/></>;
      case "avisos-parciais": return <><path d="M6 17h12l-1.8-2.5V10a4.2 4.2 0 0 0-8.4 0v4.5zM10 20h4"/><path className="btp-icon-accent" d="M12 8v4M12 14h.01M19 5l2-2M5 5 3-2"/></>;
      case "painel-erros": return <><path d="m12 3 9 17H3z"/><path className="btp-icon-accent" d="M12 9v5M12 17h.01"/></>;
      case "backup": return <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3 1.2 0 2.3-.1 3.2-.4"/><path className="btp-icon-accent" d="M19 14v7M16.5 16.5 19 14l2.5 2.5"/></>;
      case "documentos-legais": return <><path d="M5 3h10l4 4v14H5zM15 3v5h4M8 11h8M8 14h5"/><path className="btp-icon-accent" d="m13.5 18 2 2 4-4"/></>;
      default: return <><circle cx="12" cy="12" r="8"/><path className="btp-icon-accent" d="M12 8v8M8 12h8"/></>;
    }
  })();
  return <span className={`btp-icon ${className}`.trim()} aria-hidden="true"><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{glyph}</svg></span>;
}
