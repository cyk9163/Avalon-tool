export type Role = "merlin" | "percival" | "loyal" | "assassin" | "morgana" | "mordred" | "oberon" | "minion";
export type Preset = "classic" | "basic" | "mist" | "full";
export const ROLES: Record<Role, { name: string; side: "good" | "evil"; description: string }> = {
  merlin: { name: "梅林", side: "good", description: "引导好人完成任务，同时隐藏自己。三次任务成功后，仍要躲过刺客的刺杀。" },
  percival: { name: "派西维尔", side: "good", description: "你看见梅林的候选人，但莫甘娜也可能混在其中。保护真正的梅林。" },
  loyal: { name: "亚瑟的忠臣", side: "good", description: "你没有额外的身份线索。通过讨论与投票，找到值得信任的同伴。" },
  assassin: { name: "刺客", side: "evil", description: "隐藏在队伍中阻挠任务。好人完成三次任务后，你有一次刺杀梅林的机会。" },
  morgana: { name: "莫甘娜", side: "evil", description: "在派西维尔眼中，你与梅林无法区分。利用这一点隐藏自己。" },
  mordred: { name: "莫德雷德", side: "evil", description: "梅林无法看见你的邪恶身份，但其他邪恶同伴认识你（奥伯伦除外）。" },
  oberon: { name: "奥伯伦", side: "evil", description: "你与其他邪恶同伴互不相识，但梅林能看见你的邪恶身份。" },
  minion: { name: "莫德雷德的爪牙", side: "evil", description: "与邪恶同伴合作，让任务失败，并保护刺客找到梅林。" },
};
export const PRESETS: Record<Preset, { name: string; hint: string; minimum: number }> = {
  classic: { name: "经典局", hint: "梅林、派西维尔、莫甘娜、刺客", minimum: 5 },
  basic: { name: "基础局", hint: "梅林、刺客，适合初次入局", minimum: 5 },
  mist: { name: "迷雾局", hint: "经典局加入莫德雷德 · 7 人起", minimum: 7 },
  full: { name: "全角色局", hint: "加入莫德雷德与奥伯伦 · 10 人", minimum: 10 },
};
export const EVIL_COUNTS: Record<number, number> = {5:2,6:2,7:3,8:3,9:3,10:4};
export function rolePool(capacity: number, preset: Preset): Role[] {
  if (!Number.isInteger(capacity) || !(capacity in EVIL_COUNTS) || !Object.hasOwn(PRESETS, preset) || capacity < PRESETS[preset].minimum) throw new GameError("人数或角色配置无效。",400);
  const good:Role[]=["merlin"], evil:Role[]=["assassin"];
  if(preset!=="basic"){good.push("percival");evil.push("morgana");}
  if(preset==="mist"||preset==="full")evil.push("mordred");
  if(preset==="full")evil.push("oberon");
  while(good.length<capacity-EVIL_COUNTS[capacity])good.push("loyal");
  while(evil.length<EVIL_COUNTS[capacity])evil.push("minion");
  return [...good,...evil];
}
export class GameError extends Error { constructor(message:string, public status=409){super(message);} }
export interface Player { id:string; key:string; name:string; seat:number; ready:boolean; confirmed:boolean; role?:Role }
export interface Room { code:string; capacity:number; preset:Preset; phase:"lobby"|"identity"|"ready"|"closed"; hostId:string; players:Player[]; createdAt:number; expiresAt:number; requestId:string; firstLeader?:number }
export interface Identity {role:Role; side:"good"|"evil"; known:{seat:number;name:string;label:string}[]; note:string}
export interface RoomView {code:string;capacity:number;preset:Preset;phase:Room["phase"];hostId:string;version:number;players:{id:string;name:string;seat:number;ready:boolean;confirmed:boolean}[];meId:string|null;identity:Identity|null;expiresAt:number;firstLeader:number|null}
export function randomInt(max:number):number {
  const boundary=Math.floor(4294967296/max)*max;
  const data=new Uint32Array(1);
  do {crypto.getRandomValues(data);} while(data[0]>=boundary);
  return data[0]%max;
}
export function shuffle<T>(input:T[]):T[]{const out=[...input];for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
export function nickname(value:unknown):string {
  if(typeof value!=="string")throw new GameError("请填写昵称。",400);
  const name=value.trim().normalize("NFC");
  if(!name || [...name].length>12 || /[\p{Cc}\p{Cf}]/u.test(name))throw new GameError("昵称需为 1–12 个可见字符。",400);
  return name;
}
export function identityFor(room:Room, me:Player):Identity|null{
  if(!me.role || room.phase==="lobby" || room.phase==="closed")return null;
  let known:Identity["known"]=[];let note="你没有额外的身份线索。";
  if(me.role==="merlin"){
    known=room.players.filter(p=>p.role&&ROLES[p.role].side==="evil"&&p.role!=="mordred").map(p=>({seat:p.seat,name:p.name,label:"已知邪恶"}));
    note="这些座位属于邪恶阵营；如果本局有莫德雷德，他不会出现在这里。";
  } else if(me.role==="percival"){
    known=room.players.filter(p=>p.role==="merlin"||p.role==="morgana").map(p=>({seat:p.seat,name:p.name,label:"梅林候选"}));
    note="这些人中有梅林；如果本局有莫甘娜，她也会出现在这里。你无法直接区分。";
  } else if(ROLES[me.role].side==="evil"&&me.role!=="oberon"){
    known=room.players.filter(p=>p.id!==me.id&&p.role&&ROLES[p.role].side==="evil"&&p.role!=="oberon").map(p=>({seat:p.seat,name:p.name,label:"邪恶同伴"}));
    note="你们同属邪恶阵营。奥伯伦不会出现，你也无法获知同伴的具体角色。";
  } else if(me.role==="oberon")note="你不知道其他邪恶同伴是谁，他们也不认识你。梅林能看见你。";
  return {role:me.role,side:ROLES[me.role].side,known:known.sort((a,b)=>a.seat-b.seat),note};
}
export function roomView(room:Room,key:string,version:number):RoomView {
  const me=room.players.find(p=>p.key===key);
  return {code:room.code,capacity:room.capacity,preset:room.preset,phase:room.phase,hostId:room.hostId,version,players:room.players.map(({id,name,seat,ready,confirmed})=>({id,name,seat,ready,confirmed})).sort((a,b)=>a.seat-b.seat),meId:me?.id??null,identity:me?identityFor(room,me):null,expiresAt:room.expiresAt,firstLeader:room.firstLeader??null};
}
export function mutateRoom(room:Room,key:string,action:string,input:Record<string,unknown>):void{
  const me=room.players.find(p=>p.key===key);
  if(action==="join"){
    if(me)return;
    if(room.phase!=="lobby")throw new GameError("房间已发身份，不能中途加入。",403);
    const name=nickname(input.name),seat=Number(input.seat);
    if(!Number.isInteger(seat)||seat<1||seat>room.capacity)throw new GameError("请选择有效的座位。",400);
    if(room.players.some(p=>p.seat===seat))throw new GameError("这个座位刚被占用，请换一个。 ");
    if(room.players.length>=room.capacity)throw new GameError("房间已满。 ");
    room.players.push({id:crypto.randomUUID(),key,name,seat,ready:false,confirmed:false});return;
  }
  if(!me)throw new GameError("请先加入房间。",403);
  if(action==="confirm"){
    if(room.phase!=="identity"&&room.phase!=="ready")throw new GameError("还没有发身份。 ");
    me.confirmed=true;if(room.players.every(p=>p.confirmed))room.phase="ready";return;
  }
  if(action==="start"&&room.phase!=="lobby"){
    if(room.hostId!==me.id)throw new GameError("只有房主可以发身份。",403);
    return; // A retry must never reshuffle assigned identities.
  }
  if(room.phase!=="lobby")throw new GameError("发身份后，座位与配置已锁定。 ");
  if(action==="ready"){
    if(typeof input.ready!=="boolean")throw new GameError("准备状态无效。",400);
    me.ready=input.ready;return;
  }
  if(action==="seat"){
    const seat=Number(input.seat);
    if(!Number.isInteger(seat)||seat<1||seat>room.capacity)throw new GameError("请选择有效的座位。",400);
    if(room.players.some(p=>p.id!==me.id&&p.seat===seat))throw new GameError("这个座位已被占用。 ");
    me.seat=seat;me.ready=false;return;
  }
  if(action==="leave"){
    room.players=room.players.filter(p=>p.id!==me.id);
    if(!room.players.length){room.phase="closed";return;}
    if(room.hostId===me.id)room.hostId=[...room.players].sort((a,b)=>a.seat-b.seat)[0].id;
    return;
  }
  if(action==="start"){
    if(room.hostId!==me.id)throw new GameError("只有房主可以发身份。",403);
    if(room.players.length!==room.capacity || !room.players.every(p=>p.ready))throw new GameError("请等待所有座位坐满，并且全员准备。 ");
    const roles=shuffle(rolePool(room.capacity,room.preset));
    room.players.forEach((p,i)=>{p.role=roles[i];p.confirmed=false;});
    room.firstLeader=randomInt(room.capacity)+1;room.phase="identity";return;
  }
  throw new GameError("不支持这个操作。",400);
}
