// GET /api/room/live?code=123456 — WebSocket handshake for live room signals.
// Handled by the Worker entry before vinext so the 101 response reaches the
// browser untouched. Anyone allowed to read the room's public view may listen:
// a signal is only a version number, strictly less than that view reveals.
import {GameError} from "./game";
import {isWebSocketUpgrade,liveOriginAllowed} from "./live";
import {log,newRequestId,roomRef} from "./log";
import {deviceKey,enforceLookupBudget,ipKey,recordLookupMiss} from "./request-context";
import {getRoom,rateLimit} from "./room-store";

function reject(requestId:string,status:number,error:string){
  return new Response(JSON.stringify({error}),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Request-Id":requestId}});
}

export async function handleLiveRequest(request:Request,env:Cloudflare.Env):Promise<Response>{
  const requestId=newRequestId(),code=new URL(request.url).searchParams.get("code")??"";
  try{
    if(request.method!=="GET")throw new GameError("不支持的请求方式。",405);
    if(!isWebSocketUpgrade(request))throw new GameError("需要 WebSocket 连接。",426);
    if(!liveOriginAllowed(request))throw new GameError("请从圆桌页面连接。",403);
    if(!env.ROOM_HUB)throw new GameError("实时同步暂不可用，页面会自动定时同步。",503);
    const key=await deviceKey(request),ip=await ipKey(request);
    if(ip)await rateLimit(`live:${ip}`,120,60000);
    await enforceLookupBudget(ip,key,code);
    try{await getRoom(code);}catch(error){await recordLookupMiss(ip,error);throw error;}
    return await env.ROOM_HUB.getByName(code).fetch(request);
  }catch(error){
    if(error instanceof GameError){
      if(error.status===429)log("warn","live.rejected",{requestId,room:await roomRef(code),status:429});
      return reject(requestId,error.status,error.message);
    }
    log("error","live.unexpected",{requestId,room:await roomRef(code),reason:error instanceof Error?error.message:"unknown"});
    return reject(requestId,503,"实时同步暂不可用，页面会自动定时同步。");
  }
}
