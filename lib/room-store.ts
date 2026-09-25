import {env} from "cloudflare:workers";
import {signalRoom} from "./room-signal";
import {log} from "./log";
import {notifyNewTurns} from "./push-store";
import {turnMap} from "./turn";
import {recordAccountGames} from "./account-record";
import {GameError,type Room,mutateRoom,roomView,type Preset,rolePool,nickname,randomInt,newRecoveryCode,newInviteToken,ROOM_SCHEMA_VERSION} from "./game";
function db(){if(!env.DB)throw new GameError("房间服务暂时不可用，请稍后再试。",503);return env.DB;}
type Row={state:string;version:number;expires_at:number};
export async function getRoom(code:string){
  if(!/^\d{6}$/.test(code))throw new GameError("请输入 6 位房间码。",400);
  const row=await db().prepare("SELECT state, version, expires_at FROM rooms WHERE code = ?").bind(code).first<Row>();
  if(!row||row.expires_at<Date.now())throw new GameError("房间不存在或已过期，请检查房间码。",404);
  const room=JSON.parse(row.state) as Room;
  if(room.phase==="closed")throw new GameError("房间已关闭。",410);
  return {room,version:row.version};
}
/** True when the current window for this key has already used up its allowance. */
export async function rateLimited(key:string,max:number,windowMs:number){
  const window=Math.floor(Date.now()/windowMs);
  const row=await db().prepare("SELECT count FROM rate_limits WHERE key = ?").bind(`${key}:${window}`).first<{count:number}>();
  return !!row&&row.count>=max;
}
export async function rateLimit(key:string,max:number,windowMs:number){
  const window=Math.floor(Date.now()/windowMs),bucket=`${key}:${window}`;
  const row=await db().prepare("INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(bucket,(window+1)*windowMs).first<{count:number}>();
  if(!row||row.count>max)throw new GameError("操作太频繁，请稍后再试。",429);
}
export async function createRoom(key:string,input:Record<string,unknown>){
  const capacity=Number(input.capacity),preset=input.preset as Preset;
  const roles=rolePool(capacity,preset,input.roles);const name=nickname(input.name);
  const ladyOfLake=input.ladyOfLake===true;
  if(input.ladyOfLake!==undefined&&typeof input.ladyOfLake!=="boolean")throw new GameError("湖中仙女配置无效。",400);
  if(ladyOfLake&&(preset!=="custom"||capacity<7))throw new GameError("湖中仙女仅支持 7 人及以上的自定义板子。",400);
  if(input.turnSpeech!==undefined&&typeof input.turnSpeech!=="boolean")throw new GameError("发言方式无效。",400);
  const turnSpeech=input.turnSpeech===true;
  if(input.evilSeesOberon!==undefined&&typeof input.evilSeesOberon!=="boolean")throw new GameError("奥伯伦选项无效。",400);
  const evilSeesOberon=input.evilSeesOberon===true;
  if(evilSeesOberon&&!roles.includes("oberon"))throw new GameError("只有板子里有奥伯伦时，才能让坏人认识他。",400);
  if(typeof input.requestId!=="string"||!/^[a-f0-9-]{36}$/.test(input.requestId))throw new GameError("创建请求无效，请刷新重试。",400);
  const requestId=`${key}:${input.requestId}`;
  const existing=await db().prepare("SELECT state,version,expires_at FROM rooms WHERE request_id=?").bind(requestId).first<Row>();
  if(existing&&existing.expires_at>Date.now())return roomView(JSON.parse(existing.state),key,existing.version);
  await rateLimit(`create:${key}`,12,86400000);
  await db().batch([
    db().prepare("DELETE FROM rooms WHERE code IN (SELECT code FROM rooms WHERE expires_at < ? LIMIT 50)").bind(Date.now()),
    db().prepare("DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at < ? LIMIT 50)").bind(Date.now()),
  ]);
  const accountId=typeof input.accountId==="string"&&/^[a-f0-9]{32}$/.test(input.accountId)?input.accountId:undefined;
  const count=await db().prepare("SELECT count(*) as n FROM rooms WHERE owner_key = ? AND expires_at > ?").bind(key,Date.now()).first<{n:number}>();
  if(count&&count.n>=8)throw new GameError("今天建立的房间有点多，请先使用已有房间。",429);
  for(let i=0;i<8;i++){
    const code=String(100000+randomInt(900000)),id=crypto.randomUUID();
    const room:Room={code,round:1,capacity,preset,turnSpeech,evilSeesOberon,...(preset==="custom"?{customRoles:roles,ladyOfLake}:{}),phase:"lobby",hostId:id,hostRevision:0,players:[{id,key,name,seat:1,ready:false,confirmed:false,recovery:newRecoveryCode(),...(accountId?{accountId}:{})}],createdAt:Date.now(),expiresAt:Date.now()+86400000,requestId,schemaVersion:ROOM_SCHEMA_VERSION,inviteToken:newInviteToken(),takeovers:[],recoveries:[]};
    const result=await db().prepare("INSERT OR IGNORE INTO rooms (code,state,version,expires_at,owner_key,request_id) VALUES (?,?,1,?,?,?)").bind(code,JSON.stringify(room),room.expiresAt,key,requestId).run();
    if(result.meta.changes===1)return roomView(room,key,1);
    const duplicate=await db().prepare("SELECT state,version,expires_at FROM rooms WHERE request_id=?").bind(requestId).first<Row>();
    if(duplicate)return roomView(JSON.parse(duplicate.state),key,duplicate.version);
  }
  throw new GameError("暂时无法建立房间，请重试。",503);
}
export async function changeRoom(code:string,key:string,action:string,input:Record<string,unknown>,invite?:string|null,stats?:{conflicts:number}){
  for(let attempt=0;attempt<24;attempt++){
    const {room,version}=await getRoom(code);
    const beforeTurns=turnMap(room);
    mutateRoom(room,key,action,input);
    const result=await db().prepare("UPDATE rooms SET state=?, version=version+1 WHERE code=? AND version=? AND expires_at>?").bind(JSON.stringify(room),code,version,Date.now()).run();
    if(result.meta.changes===1){
      signalRoom(code,version+1);
      void notifyNewTurns(beforeTurns,room).catch(error=>log("warn","push.failed",{reason:error instanceof Error?error.message:"unknown"}));
      void recordAccountGames(room).catch(error=>log("warn","account.record",{reason:error instanceof Error?error.message:"unknown"}));
      return roomView(room,key,version+1,invite);
    }
    if(stats)stats.conflicts++;
    await new Promise(resolve=>setTimeout(resolve,5+randomInt(20)));
  }
  throw new GameError("朋友们正在同时操作，请再试一次。 ");
}
