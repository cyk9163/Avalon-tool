import {env} from "cloudflare:workers";
import {configuredAdminKeys,verifyAdminKey} from "@/lib/admin-key";
import {collectAdminStats} from "@/lib/admin-stats";
import {GameError} from "@/lib/game";
import {log,newRequestId} from "@/lib/log";
import {ipKey} from "@/lib/request-context";
import {rateLimit,rateLimited} from "@/lib/room-store";
import {setHostRight} from "@/lib/account";
import {APP_VERSION} from "@/lib/version";
export const dynamic="force-dynamic";
// Wrong admin keys per network: ten tries per ten minutes.
const ADMIN_FAILURES={max:10,windowMs:600000};
const ADMIN_HEADER="x-admin-key";
function response(requestId:string,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","X-Request-Id":requestId,"X-Robots-Tag":"noindex"}});}
function hashCount(configuration:unknown){return typeof configuration==="string"?configuration.split(/[\s,]+/).filter(hash=>/^[a-f0-9]{64}$/i.test(hash)).length:0;}
// GET /api/admin — aggregate, anonymous statistics for the operator. The key
// travels in a custom header, which a cross-site page cannot attach.
export async function GET(request:Request){
  const requestId=newRequestId(),started=Date.now();let status=200;
  try{
    const origin=request.headers.get("origin");
    if((origin&&origin!==new URL(request.url).origin)||request.headers.get("sec-fetch-site")==="cross-site")throw new GameError("请从管理页面访问。",403);
    const ip=await ipKey(request),bucket=ip?`admin-fail:${ip}`:null;
    if(bucket&&await rateLimited(bucket,ADMIN_FAILURES.max,ADMIN_FAILURES.windowMs))throw new GameError("管理员 Key 错误次数过多，请 10 分钟后再试。",429);
    const typed=request.headers.get(ADMIN_HEADER);
    if(!typed)throw new GameError("请输入管理员 Key。",401);
    const verified=await verifyAdminKey(typed,env.ADMIN_KEY_HASHES);
    if(verified===null)throw new GameError("管理后台尚未配置。",503);
    if(!verified){if(bucket)await rateLimit(bucket,Number.MAX_SAFE_INTEGER,ADMIN_FAILURES.windowMs);throw new GameError("管理员 Key 无效。",403);}
    if(!env.DB)throw new GameError("数据库暂时不可用。",503);
    const dbStarted=Date.now();
    const stats=await collectAdminStats(env.DB,started);
    const result=response(requestId,{
      ...stats,
      service:{version:APP_VERSION,databaseMs:Date.now()-dbStarted,liveHub:!!env.ROOM_HUB,hostKeys:hashCount(env.HOST_KEY_HASHES),adminKeys:configuredAdminKeys(env.ADMIN_KEY_HASHES)},
    });
    log("info","admin.stats",{requestId,status:200,durationMs:Date.now()-started});
    return result;
  }catch(error){
    if(error instanceof GameError){status=error.status;log(status>=500?"error":"warn","admin.stats",{requestId,status,durationMs:Date.now()-started});return response(requestId,{error:error.message},status);}
    log("error","admin.unexpected",{requestId,reason:error instanceof Error?error.message:"unknown"});
    return response(requestId,{error:`管理后台暂时不可用。（错误编号 ${requestId.slice(0,8)}）`},503);
  }
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  try {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new GameError("请从管理页面访问。", 403);
    const typed = request.headers.get(ADMIN_HEADER);
    const verified = await verifyAdminKey(typed, env.ADMIN_KEY_HASHES);
    if (!verified) throw new GameError("管理员 Key 无效。", 403);
    const body = await request.json() as { name?: unknown; canHost?: unknown };
    await setHostRight(body.name, body.canHost === true);
    log("info", "admin.host", { requestId, status: 200 });
    return response(requestId, { ok: true });
  } catch (error) {
    const message = error instanceof GameError ? error.message : "管理后台暂时不可用。";
    return response(requestId, { error: message }, error instanceof GameError ? error.status : 503);
  }
}
