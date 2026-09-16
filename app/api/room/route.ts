import {GameError,roomView} from "@/lib/game";
import {getRoom,createRoom,changeRoom,rateLimit} from "@/lib/room-store";
export const dynamic="force-dynamic";
const cookieName="avalon_device";
async function hash(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,"0")).join("");}
function token(request:Request){const match=request.headers.get("cookie")?.match(/(?:^|;\s*)avalon_device=([a-f0-9]{64})(?:;|$)/);return match?.[1];}
function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,"0")).join("");}
function response(data:unknown,status=200,cookie?:string,secure=false){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff",...(cookie?{"Set-Cookie":`${cookieName}=${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure?"; Secure":""}`}:{})}});}
function fail(error:unknown){if(error instanceof GameError)return response({error:error.message},error.status);console.error("Room operation failed",error instanceof Error?error.message:"unknown");return response({error:"房间服务暂时不可用，你的操作未确认，请稍后重试。"},503);}
function sameOrigin(request:Request){const origin=request.headers.get("origin"),url=new URL(request.url);if(origin&&origin!==url.origin)throw new GameError("请从圆桌页面发起操作。",403);if(request.headers.get("sec-fetch-site")==="cross-site")throw new GameError("不接受跨站操作。",403);}
export async function GET(request:Request){try{
  const url=new URL(request.url);
  if(url.searchParams.get("session")==="1"){
    sameOrigin(request);const current=token(request);return response({ok:true},200,current?undefined:newToken(),url.protocol==="https:");
  }
  const key=token(request)?await hash(token(request)!):"";
  const ip=request.headers.get("cf-connecting-ip");if(ip)await rateLimit(`read:${await hash(ip)}`,3600,60000);
  const {room,version}=await getRoom(url.searchParams.get("code")??"");
  return response(roomView(room,key,version));
}catch(error){return fail(error);}}
export async function POST(request:Request){try{
  sameOrigin(request);
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new GameError("请求格式无效。",415);
  const raw=await request.text();if(raw.length>2048)throw new GameError("请求过大。",413);
  let input:Record<string,unknown>;try{input=JSON.parse(raw);}catch{throw new GameError("请求格式无效。",400);}
  if(!input||typeof input!=="object"||Array.isArray(input))throw new GameError("请求格式无效。",400);
  const current=token(request);if(!current)throw new GameError("请刷新页面后重试，并允许本站 Cookie。",401);
  const key=await hash(current);await rateLimit(`write:${key}`,90,60000);
  const ip=request.headers.get("cf-connecting-ip");if(ip)await rateLimit(`write-ip:${await hash(ip)}`,600,60000);
  if(input.action==="create")return response(await createRoom(key,input));
  if(typeof input.code!=="string"||typeof input.action!=="string")throw new GameError("房间操作无效。",400);
  return response(await changeRoom(input.code,key,input.action,input));
}catch(error){return fail(error);}}
