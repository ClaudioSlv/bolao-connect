import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(request:NextRequest){
  const {searchParams,origin}=new URL(request.url);
  const code=searchParams.get("code");
  const next=searchParams.get("next")??"/nova-senha";

  if(code){
    const s=await createClient();
    const {error}=await s.auth.exchangeCodeForSession(code);
    if(!error)return NextResponse.redirect(`${origin}${next.startsWith("/")?next:"/nova-senha"}`);
  }

  return NextResponse.redirect(`${origin}/esqueci-senha?erro=link`);
}
