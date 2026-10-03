"use client";

export function OrganizerCta(){
  const share=async()=>{
    const data={
      title:"JuntaSorte",
      text:"Participe do bolão pelo JuntaSorte:",
      url:window.location.href,
    };
    try{
      if(navigator.share){
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      alert("Link do bolão copiado para compartilhar.");
    }catch(error){
      if(error instanceof DOMException&&error.name==="AbortError")return;
    }
  };

  return <section className="section organizer-cta">
    <h2>📲 Compartilhe este bolão</h2>
    <p className="muted">Envie este link para seus amigos participarem e acompanharem o bolão.</p>
    <button className="button primary" type="button" onClick={share}>📤 COMPARTILHAR</button>
  </section>;
}
