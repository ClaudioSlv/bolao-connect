"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Option = { value: string; label: string };

export function LotterySelector({value,options}:{value:string;options:Option[]}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected,setSelected] = useState(value);
  const [pending,startTransition] = useTransition();

  function change(next:string) {
    setSelected(next);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("lottery", next);
    startTransition(()=>router.replace(`/meu-jogo?${nextParams.toString()}`));
  }

  return <div className="form"><div className="field"><label>Modalidade</label><select value={selected} onChange={e=>change(e.target.value)} disabled={pending}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>{pending&&<span className="muted">Atualizando modalidade…</span>}</div>;
}
