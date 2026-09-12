"use server";
import {revalidatePath} from "next/cache";import {createClient} from "@/lib/supabase/server";import type {LotteryId} from "@/lib/domain";
const rules:Record<LotteryId,{min:number;max:number;minNumbers:number;maxNumbers:number}>={"mega-sena":{min:1,max:60,minNumbers:6,maxNumbers:20},lotofacil:{min:1,max:25,minNumbers:15,maxNumbers:20},quina:{min:1,max:80,minNumbers:5,maxNumbers:15},"dupla-sena":{min:1,max:50,minNumbers:6,maxNumbers:15},lotomania:{min:0,max:99,minNumbers:50,maxNumbers:50},timemania:{min:1,max:80,minNumbers:10,maxNumbers:10},"dia-de-sorte":{min:1,max:31,minNumbers:7,maxNumbers:15},"super-sete":{min:0,max:9,minNumbers:7,maxNumbers:7},"mais-milionaria":{min:1,max:50,minNumbers:6,maxNumbers:12}};
async function owner(poolId:string){const s=await createClient();const {data:a}=await s.auth.getUser();if(!a.user)throw new Error("Faça login para continuar.");const {data:p}=await s.from("pools").select("owner_id,lottery,contest_number").eq("id",poolId).single();if(!p||p.owner_id!==a.user.id)throw new Error("Você não pode alterar este bolão.");return{s,lottery:p.lottery as LotteryId,contest:p.contest_number as number|null};}
export async function addGame(input:{poolId:string;numbers:number[];receiptPath?:string;specialValue?:unknown}){if(!input.poolId||!input.numbers?.length)throw new Error("Informe o bolão e as dezenas.");const numbers=input.numbers.map(Number);if(numbers.some(n=>!Number.isInteger(n)))throw new Error("As dezenas informadas são inválidas.");const {s,lottery,contest}=await owner(input.poolId);const r=rules[lottery];if(numbers.length<r.minNumbers||numbers.length>r.maxNumbers)throw new Error(`Quantidade inválida. Use de ${r.minNumbers} a ${r.maxNumbers}.`);if(lottery!=="super-sete"&&new Set(numbers).size!==numbers.length)throw new Error("Não repita dezenas no mesmo jogo.");if(numbers.some(n=>n<r.min||n>r.max))throw new Error(`As dezenas devem ficar entre ${r.min} e ${r.max}.`);
 let special=input.specialValue??null;if(lottery==="mais-milionaria"){const trevos=Array.isArray(special)?special.map(Number):[];if(trevos.length<2||trevos.length>6||new Set(trevos).size!==trevos.length||trevos.some(n=>!Number.isInteger(n)||n<1||n>6))throw new Error("Informe de 2 a 6 Trevos válidos.");special={trevos};}else if(lottery==="dia-de-sorte"){const mes=Number(special);if(!Number.isInteger(mes)||mes<1||mes>12)throw new Error("Informe o Mês da Sorte de 1 a 12.");special={mes};}else if(lottery==="timemania"){const time=String(special??"").trim();if(!time)throw new Error("Informe o Time do Coração.");special={time};}
 const stored=lottery==="super-sete"?[...numbers]:[...numbers].sort((a,b)=>a-b);const {data,error}=await s.from("games").insert({pool_id:input.poolId,lottery,contest_number:contest,numbers:stored,special_value:special,receipt_path:input.receiptPath?.trim()||null}).select().single();if(error)throw new Error(error.message);revalidatePath("/");revalidatePath("/jogos");revalidatePath("/conferencia");return data;}


export async function deleteGame(poolId:string,gameId:string){
 if(!poolId||!gameId)throw new Error("Jogo não informado.");
 const {s}=await owner(poolId);
 const {data:game,error:lookupError}=await s.from("games").select("id,pool_id").eq("id",gameId).eq("pool_id",poolId).maybeSingle();
 if(lookupError||!game)throw new Error("Jogo não encontrado.");
 const {error}=await s.from("games").delete().eq("id",gameId).eq("pool_id",poolId);
 if(error)throw new Error("Não foi possível excluir o jogo.");
 revalidatePath("/jogos");
 revalidatePath("/conferencia");
 return {ok:true};
}
