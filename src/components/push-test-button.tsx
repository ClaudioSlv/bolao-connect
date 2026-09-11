"use client";
import {useActionState} from "react";
import {sendParticipantTestPush,type PushTestState} from "@/app/actions/push";
const initialState:PushTestState={status:"idle",message:""};
export function PushTestButton({token}:{token:string}){const[state,action,pending]=useActionState(sendParticipantTestPush,initialState);return <form action={action} style={{display:"contents"}}><input type="hidden" name="token" value={token}/><button className="button secondary" type="submit" disabled={pending}>{pending?"ENVIANDO...":"🔔 TESTAR NOTIFICAÇÃO"}</button>{state.message&&<span className="status" style={{color:state.status==="sent"?"#52f47d":"#facc15",fontWeight:800}}>{state.message}</span>}</form>}
