import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const dynamic="force-dynamic";

export async function GET(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const status={
    urlConfigured:Boolean(url),
    secretConfigured:Boolean(key),
    canConnect:false,
    stage:"config" as "config"|"query"|"ok",
  };

  if(!url||!key)return NextResponse.json(status,{status:503});

  try{
    const s=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await s.from("pools").select("id").limit(1);
    if(error)return NextResponse.json({...status,stage:"query"},{status:503});
    return NextResponse.json({...status,canConnect:true,stage:"ok"});
  }catch{
    return NextResponse.json({...status,stage:"query"},{status:503});
  }
}
