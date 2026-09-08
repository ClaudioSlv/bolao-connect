import "server-only";

export const DEFAULT_APP_BRAND="Bolão Amigos BTP";

export type OrganizerBrand={
  name:string;
  logoUrl?:string;
  organizerSlug?:string;
  customDomain?:string;
  domainStatus?:string;
};

export async function getOrganizerBrand(supabase:any,ownerId?:string|null):Promise<OrganizerBrand>{
  if(!ownerId)return {name:DEFAULT_APP_BRAND};

  try{
    const {data,error}=await supabase
      .from("profiles")
      .select("display_name,brand_name,logo_url,organizer_slug,custom_domain,domain_status")
      .eq("id",ownerId)
      .maybeSingle();

    if(error)throw error;
    return {
      name:String(data?.brand_name||data?.display_name||DEFAULT_APP_BRAND).trim()||DEFAULT_APP_BRAND,
      logoUrl:data?.logo_url||undefined,
      organizerSlug:data?.organizer_slug||undefined,
      customDomain:data?.custom_domain||undefined,
      domainStatus:data?.domain_status||undefined,
    };
  }catch{
    // Compatibilidade enquanto a migração multi-organizador ainda não tiver sido aplicada no Supabase.
    return {name:DEFAULT_APP_BRAND};
  }
}
