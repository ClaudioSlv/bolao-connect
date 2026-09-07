"use client";
import {usePathname} from "next/navigation";
import {ReminderOptIn} from "@/components/reminder-opt-in";

export function ParticipantReminderGate(){
  const pathname=usePathname();
  const match=pathname.match(/^\/p\/([0-9a-fA-F-]{30,})$/);
  if(!match)return null;
  return <div className="shell" style={{paddingTop:0}}><ReminderOptIn token={match[1]}/></div>;
}
