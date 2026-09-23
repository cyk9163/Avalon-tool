// Request identity and network budgets shared by the room API and the live
// WebSocket gateway, so both entry points enforce the same limits.
import {GameError} from "./game";
import {getRoom,rateLimit,rateLimited} from "./room-store";
// Failed lookups of unknown room codes, per client IP: blunts code enumeration.
export const LOOKUP_MISSES={max:30,windowMs:600000};
export async function hash(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,"0")).join("");}
export function deviceToken(request:Request){const match=request.headers.get("cookie")?.match(/(?:^|;\s*)avalon_device=([a-f0-9]{64})(?:;|$)/);return match?.[1];}
/** SHA-256 of the device cookie, or "" for a visitor without one. */
export async function deviceKey(request:Request){const current=deviceToken(request);return current?await hash(current):"";}
// Network budgets use the client IP Cloudflare reports. The local dev server
// reports loopback for every client, so budgets are not applied there.
export async function ipKey(request:Request){const ip=request.headers.get("cf-connecting-ip");return ip&&!/^(127\.|::1$|::ffff:127\.)/.test(ip)?await hash(ip):null;}
// Once a network has used up its budget of unknown-code lookups, only devices
// already seated in the room may keep reading or acting on it. Players sharing
// the party Wi-Fi are never locked out of their own room by someone probing.
export async function enforceLookupBudget(ip:string|null,key:string,code:string){
  if(!ip||!await rateLimited(`miss:${ip}`,LOOKUP_MISSES.max,LOOKUP_MISSES.windowMs))return;
  const found=await getRoom(code).catch(()=>null);
  if(!found||!found.room.players.some(player=>player.key===key))throw new GameError("查找房间的次数太多，请稍后再试。",429);
}
/** Counts an unknown-code lookup against the network's budget. */
export async function recordLookupMiss(ip:string|null,error:unknown){
  if(ip&&error instanceof GameError&&error.status===404)await rateLimit(`miss:${ip}`,Number.MAX_SAFE_INTEGER,LOOKUP_MISSES.windowMs);
}
