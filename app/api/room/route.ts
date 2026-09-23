import {env} from "cloudflare:workers";
import {GameError,roomView} from "@/lib/game";
import {verifyHostKey} from "@/lib/host-key";
import {log,newRequestId,roomRef} from "@/lib/log";
import {getRoom,createRoom,changeRoom,rateLimit,rateLimited} from "@/lib/room-store";
import {hash,deviceToken as token,ipKey,enforceLookupBudget,recordLookupMiss} from "@/lib/request-context";
export const dynamic="force-dynamic";
const cookieName="avalon_device";
const INVITE_HEADER="x-avalon-invite";
const RECOVER_FAILURES={max:8,windowMs:600000};
function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,"0")).join("");}
function inviteFrom(request:Request){const value=request.headers.get(INVITE_HEADER);return value&&/^[A-Za-z0-9_-]{16,64}$/.test(value)?value:null;}
function response(requestId:string,data:unknown,status=200,cookie?:string,secure=false){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff","X-Request-Id":requestId,...(cookie?{"Set-Cookie":`${cookieName}=${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure?"; Secure":""}`}:{})}});}
function fail(requestId:string,error:unknown){
  if(error instanceof GameError)return response(requestId,{error:error.message},error.status);
  log("error","room.unexpected",{requestId,reason:error instanceof Error?error.message:"unknown"});
  return response(requestId,{error:`房间服务暂时不可用，你的操作未确认，请稍后重试。（错误编号 ${requestId.slice(0,8)}）`,requestId},503);
}
function sameOrigin(request:Request){const origin=request.headers.get("origin"),url=new URL(request.url);if(origin&&origin!==url.origin)throw new GameError("请从圆桌页面发起操作。",403);if(request.headers.get("sec-fetch-site")==="cross-site")throw new GameError("不接受跨站操作。",403);}
async function readBody(request:Request){
  const length=request.headers.get("content-length");
  if(length&&/^\d+$/.test(length)&&Number(length)>2048)throw new GameError("请求过大。",413);
  const reader=request.body?.getReader();if(!reader)return "";
  const decoder=new TextDecoder();let bytes=0,raw="";
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;
      if(bytes>2048){await reader.cancel().catch(()=>{});throw new GameError("请求过大。",413);}
      raw+=decoder.decode(value,{stream:true});
    }
    return raw+decoder.decode();
  }finally{reader.releaseLock();}
}
export async function GET(request:Request){
  const requestId=newRequestId(),started=Date.now();let result:Response;
  const url=new URL(request.url),code=url.searchParams.get("code")??"";
  try{
    if(url.searchParams.get("session")==="1"){
      sameOrigin(request);const current=token(request);return response(requestId,{ok:true},200,current?undefined:newToken(),url.protocol==="https:");
    }
    const key=token(request)?await hash(token(request)!):"";
    const ip=await ipKey(request);
    if(ip)await rateLimit(`read:${ip}`,3600,60000);
    await enforceLookupBudget(ip,key,code);
    try{
      const {room,version}=await getRoom(code);
      result=response(requestId,roomView(room,key,version,inviteFrom(request)));
    }catch(error){
      await recordLookupMiss(ip,error);
      throw error;
    }
  }catch(error){result=fail(requestId,error);}
  // Successful polls are not logged: they are frequent and carry no signal.
  if(result.status===429||result.status>=500){
    log(result.status>=500?"error":"warn","room.read",{requestId,room:await roomRef(code),status:result.status,durationMs:Date.now()-started,ray:request.headers.get("cf-ray")});
  }
  return result;
}
export async function POST(request:Request){
  const requestId=newRequestId(),started=Date.now(),stats={conflicts:0};
  let action="unknown",code:unknown=null,result:Response;
  try{
    sameOrigin(request);
    if(!request.headers.get("content-type")?.startsWith("application/json"))throw new GameError("请求格式无效。",415);
    const raw=await readBody(request);
    let input:Record<string,unknown>;try{input=JSON.parse(raw);}catch{throw new GameError("请求格式无效。",400);}
    if(!input||typeof input!=="object"||Array.isArray(input))throw new GameError("请求格式无效。",400);
    if(typeof input.action==="string"&&input.action.length<=32)action=input.action;
    code=input.code;
    const current=token(request);if(!current)throw new GameError("请刷新页面后重试，并允许本站 Cookie。",401);
    const key=await hash(current);await rateLimit(`write:${key}`,90,60000);
    const ip=await ipKey(request);if(ip)await rateLimit(`write-ip:${ip}`,600,60000);
    if(input.action==="create"){
      const {hostKey,...creation}=input;
      const verified=await verifyHostKey(hostKey,env.HOST_KEY_HASHES);
      if(verified===null)throw new GameError("房主 Key 服务尚未配置，请联系管理员。",503);
      if(!verified)throw new GameError("房主 Key 无效，请检查后重试。",403);
      const created=await createRoom(key,creation);code=created.code;
      result=response(requestId,created);
    }else{
      if(typeof input.code!=="string"||typeof input.action!=="string")throw new GameError("房间操作无效。",400);
      // Unknown codes count against the same enumeration budget as GET lookups.
      await enforceLookupBudget(ip,key,input.code);
      // Only wrong recovery codes are counted, per seat and per network, so
      // junk requests cannot lock the real player out of their own seat.
      const recoverBuckets=input.action==="recover"?[`recover:${input.code}:${String(input.seat).slice(0,2)}`,...(ip?[`recover-ip:${ip}`]:[])]:[];
      for(const bucket of recoverBuckets)if(await rateLimited(bucket,RECOVER_FAILURES.max,RECOVER_FAILURES.windowMs))throw new GameError("恢复码错误次数过多，请 10 分钟后再试，或请房主批准。",429);
      if(input.action==="takeover-request"){
        await rateLimit(`takeover:${key}`,20,600000);
        if(ip)await rateLimit(`takeover-ip:${ip}`,12,600000);
      }
      try{
        result=response(requestId,await changeRoom(input.code,key,input.action,input,inviteFrom(request),stats));
      }catch(error){
        await recordLookupMiss(ip,error);
        if(error instanceof GameError&&error.status===403)for(const bucket of recoverBuckets)await rateLimit(bucket,Number.MAX_SAFE_INTEGER,RECOVER_FAILURES.windowMs);
        throw error;
      }
    }
  }catch(error){result=fail(requestId,error);}
  log(result.status>=500?"error":result.status>=400?"warn":"info","room.action",{
    requestId,action,room:await roomRef(code),status:result.status,durationMs:Date.now()-started,conflicts:stats.conflicts,ray:request.headers.get("cf-ray"),
  });
  return result;
}
