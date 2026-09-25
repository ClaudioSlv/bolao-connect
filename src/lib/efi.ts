import https from "node:https";

const baseUrl = "https://pix.api.efipay.com.br";

function config() {
  const clientId = process.env.EFI_CLIENT_ID_PROD?.trim();
  const clientSecret = process.env.EFI_CLIENT_SECRET_PROD?.trim();
  const certificate = process.env.EFI_CERTIFICATE_BASE64?.trim();
  if (!clientId || !clientSecret || !certificate) throw new Error("Efí não configurada.");
  return { clientId, clientSecret, pfx: Buffer.from(certificate, "base64") };
}

function request(path:string, options:{method?:string;token?:string;body?:unknown;headers?:Record<string,string>}={}) {
  const {clientId,clientSecret,pfx}=config();
  const body=options.body===undefined?undefined:JSON.stringify(options.body);
  return new Promise<{status:number;data:any}>((resolve,reject)=>{
    const req=https.request(baseUrl+path,{
      method:options.method||"GET",pfx,passphrase:"",
      headers:{
        "Accept":"application/json","Content-Type":"application/json",
        ...(options.token?{Authorization:`Bearer ${options.token}`}:{Authorization:`Basic ${Buffer.from(clientId+":"+clientSecret).toString("base64")}`}),
        ...(body?{"Content-Length":Buffer.byteLength(body)}:{}),
        ...(options.headers||{})
      }
    },res=>{let raw="";res.setEncoding("utf8");res.on("data",c=>raw+=c);res.on("end",()=>{let data:any=null;try{data=raw?JSON.parse(raw):null}catch{data={raw}}resolve({status:res.statusCode||500,data})})});
    req.on("error",reject); if(body)req.write(body); req.end();
  });
}

export async function efiToken(){
  const r=await request("/oauth/token",{method:"POST",body:{grant_type:"client_credentials"}});
  if(r.status<200||r.status>=300||!r.data?.access_token) throw new Error(r.data?.mensagem||r.data?.detail||`Falha OAuth Efí (${r.status})`);
  return String(r.data.access_token);
}
export async function efiRequest(path:string,options:{method?:string;body?:unknown;headers?:Record<string,string>}={}){
  const token=await efiToken(); return request(path,{...options,token});
}
export function efiConfigured(){return Boolean(process.env.EFI_CLIENT_ID_PROD&&process.env.EFI_CLIENT_SECRET_PROD&&process.env.EFI_CERTIFICATE_BASE64&&process.env.EFI_PIX_KEY)}
