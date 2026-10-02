import Image from "next/image";

export default function Loading() {
  return <main className="juntasorte-loading" aria-live="polite" aria-busy="true">
    <div className="juntasorte-loading-clovers"><i/><i/><i/><i/></div>
    <section className="juntasorte-loading-content">
      <Image src="/juntasorte-logo-loading.png" alt="JuntaSorte" width={1024} height={1024} priority className="juntasorte-loading-logo"/>
      <p className="juntasorte-loading-tagline">BOLÕES DE VERDADE,<br/>GENTE DE CONFIANÇA</p>
      <div className="juntasorte-loading-track" role="status" aria-label="Carregando JuntaSorte"><div className="juntasorte-loading-progress"/></div>
      <span className="juntasorte-loading-text">Carregando...</span>
    </section>
    <div className="juntasorte-loading-ribbons"><i/><b/></div>
    <style>{`
      .juntasorte-loading{position:fixed;inset:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 36%,#0b4a31 0,#063020 30%,#03170f 62%,#010906 100%);padding:24px}
      .juntasorte-loading-content{width:100%;max-width:430px;display:flex;flex-direction:column;align-items:center;text-align:center;z-index:2;transform:translateY(-2vh)}
      .juntasorte-loading-logo{width:min(82vw,360px);height:min(42dvh,360px);object-fit:contain;object-position:center;filter:drop-shadow(0 16px 28px rgba(0,0,0,.42)) brightness(1.04) saturate(1.08)}
      .juntasorte-loading-tagline{margin:12px 0 34px;color:rgba(255,255,255,.88);font-size:clamp(13px,3.7vw,18px);line-height:1.55;letter-spacing:.15em}
      .juntasorte-loading-track{width:min(68vw,290px);height:9px;border:1px solid rgba(32,255,119,.75);border-radius:999px;background:rgba(0,0,0,.25);overflow:hidden;box-shadow:0 0 12px rgba(22,225,100,.15)}
      .juntasorte-loading-progress{width:48%;height:100%;border-radius:999px;background:linear-gradient(90deg,#0bd95e,#45ff83);box-shadow:0 0 10px rgba(42,255,119,.7);animation:juntasorteProgress 1.35s ease-in-out infinite}
      .juntasorte-loading-text{margin-top:14px;color:rgba(255,255,255,.86);font-size:.95rem}
      .juntasorte-loading-clovers{position:absolute;inset:0;opacity:.12}.juntasorte-loading-clovers i{position:absolute;width:150px;height:150px;transform:rotate(45deg);background:radial-gradient(circle at 32% 32%,#21a85f 0,#07552e 62%,transparent 64%);border-radius:55% 50% 55% 50%}.juntasorte-loading-clovers i:before,.juntasorte-loading-clovers i:after{content:"";position:absolute;width:100%;height:100%;border-radius:inherit;background:inherit}.juntasorte-loading-clovers i:before{transform:rotate(90deg)}.juntasorte-loading-clovers i:after{transform:rotate(180deg)}.juntasorte-loading-clovers i:nth-child(1){right:-20px;top:10%;transform:rotate(25deg) scale(1.1)}.juntasorte-loading-clovers i:nth-child(2){left:-60px;top:28%;transform:rotate(-20deg) scale(.7)}.juntasorte-loading-clovers i:nth-child(3){right:8%;bottom:15%;transform:rotate(20deg) scale(.65)}.juntasorte-loading-clovers i:nth-child(4){left:8%;bottom:4%;transform:rotate(-8deg) scale(.58)}
      .juntasorte-loading-ribbons{position:absolute;left:-10%;right:-10%;bottom:-3%;height:28%;transform:rotate(2deg)}.juntasorte-loading-ribbons i,.juntasorte-loading-ribbons b{position:absolute;left:-5%;width:115%;height:42%;border-radius:50%;transform:rotate(10deg);border-top:3px solid rgba(255,208,51,.9)}.juntasorte-loading-ribbons i{bottom:20%;background:linear-gradient(160deg,rgba(255,190,23,.9),rgba(108,63,0,.45) 45%,rgba(4,72,37,.25) 72%,transparent 73%);clip-path:polygon(0 22%,45% 65%,100% 82%,100% 100%,0 100%)}.juntasorte-loading-ribbons b{bottom:2%;background:linear-gradient(165deg,rgba(4,76,39,.15),rgba(12,146,69,.82) 58%,rgba(2,46,24,.8));clip-path:polygon(0 48%,42% 75%,100% 20%,100% 100%,0 100%)}
      @keyframes juntasorteProgress{0%{transform:translateX(-115%)}50%{transform:translateX(110%)}100%{transform:translateX(215%)}}@media(prefers-reduced-motion:reduce){.juntasorte-loading-progress{animation:none;width:100%}}
    `}</style>
  </main>;
}
