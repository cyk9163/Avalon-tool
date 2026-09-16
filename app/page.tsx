"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Shield, Users, Crown, KeyRound, Check, Copy, QrCode, Eye, EyeOff, RefreshCw, LogOut, LockKeyhole, CircleHelp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ROLES, PRESETS, rolePool, EVIL_COUNTS, type Preset, type RoomView } from "@/lib/game";

type Mode="create"|"join";
let sessionBootstrap:Promise<unknown>|null=null;
function ensureSession(){
  if(!sessionBootstrap){
    const initialize=()=>request("/api/room?session=1");
    sessionBootstrap=(navigator.locks?navigator.locks.request("avalon:session",initialize):initialize()).catch(error=>{sessionBootstrap=null;throw error;});
  }
  return sessionBootstrap;
}
async function request<T=RoomView>(path:string,body?:Record<string,unknown>):Promise<T> {
  const res=await fetch(path,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  let result;try{result=await res.json();}catch{throw new Error("服务暂时不可用，请稍后重试。");}
  if(!res.ok)throw new Error((result as {error?:string})?.error||"操作未完成，请重试。");
  return result as T;
}
function Brand({onHome}:{onHome:()=>void}){return <a className="brand" href="/" onClick={e=>{e.preventDefault();onHome();}} aria-label="圆桌首页"><span className="brand-icon"><Crown size={22}/></span><span>圆桌<span className="brand-sub">AVALON</span></span></a>;}
function RoleChips({count,preset}:{count:number;preset:Preset}){
  const pool=rolePool(count,preset);
  return <div className="role-chips">{[...new Set(pool)].map(role=><span className={`role-chip ${ROLES[role].side}`} key={role}>{ROLES[role].name}{pool.filter(r=>r===role).length>1?` ×${pool.filter(r=>r===role).length}`:""}</span>)}</div>;
}
function Table({count,room,onSeat,disabled}:{count:number;room?:RoomView|null;onSeat?:(seat:number)=>void;disabled?:boolean}){
  return <div className={`roundtable ${room?"live-table":""}`}><div className="table-center"><Crown size={32} strokeWidth={1.3}/><span>AVALON</span><p>{room?`${room.players.length} / ${count} 位已入座`:"每个人，都有自己的秘密。"}</p></div>{Array.from({length:count},(_,i)=>{
    const player=room?.players.find(p=>p.seat===i+1),mine=!!player&&player.id===room?.meId;
    return <div className="seat-position" key={i} style={{left:`${50+40*Math.sin(i*2*Math.PI/count)}%`,top:`${50-40*Math.cos(i*2*Math.PI/count)}%`}}><button type="button" className={`seat-circle ${player?"occupied":""} ${mine?"mine":""}`} disabled={disabled||!onSeat||!!player} onClick={()=>onSeat?.(i+1)} aria-label={`${i+1} 号座位${player?`，${player.name}${mine?"，我":""}`:"，空位"}`}><span>{String(i+1).padStart(2,"0")}</span>{player&&(room?.phase==="lobby"?player.ready:player.confirmed)&&<Check className="seat-check" size={14}/>}</button>{room&&<span className={`seat-name ${mine?"mine":""}`}>{player?`${player.name}${mine?" · 我":""}`:"待入座"}</span>}</div>;
  })}</div>;
}

export default function Home(){
  const [mode,setMode]=useState<Mode>("create"),[name,setName]=useState(""),[capacity,setCapacity]=useState(7),[preset,setPreset]=useState<Preset>("classic"),[code,setCode]=useState("");
  const [room,setRoom]=useState<RoomView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sessionReady,setSessionReady]=useState(false),[connected,setConnected]=useState(true);
  const [share,setShare]=useState(false),[qr,setQr]=useState(""),[copied,setCopied]=useState(false),[reveal,setReveal]=useState(false),[seen,setSeen]=useState(false),[confirmStart,setConfirmStart]=useState(false),[confirmLeave,setConfirmLeave]=useState(false),[help,setHelp]=useState(false);
  const currentCode=useRef(""),createId=useRef(""),latest=useRef<RoomView|null>(null),busyRef=useRef(false);
  const accept=useCallback((data:RoomView)=>{
    if(data.code!==currentCode.current)return;
    if(latest.current?.code===data.code&&latest.current.version>data.version)return;
    latest.current=data;setRoom(data);setConnected(true);
  },[]);
  const load=useCallback(async(target:string)=>{const data=await request(`/api/room?code=${encodeURIComponent(target)}`);accept(data);return data as RoomView;},[accept]);
  useEffect(()=>{
    let cancelled=false;
    ensureSession().then(async()=>{
      if(cancelled)return;setSessionReady(true);
      let saved="";try{saved=localStorage.getItem("avalon:last-room")||"";setName(localStorage.getItem("avalon:nickname")||"");}catch{}
      const target=new URLSearchParams(location.search).get("room")||saved;
      if(/^\d{6}$/.test(target)){currentCode.current=target;setCode(target);setMode("join");try{await load(target);}catch(e){if(!cancelled)setError((e as Error).message);}}
    }).catch(()=>{if(!cancelled)setError("暂时无法连接圆桌。请检查网络后刷新页面。");});
    return()=>{cancelled=true;};
  },[load]);
  useEffect(()=>{
    if(!room?.code)return;
    let cancelled=false,inFlight=false,timer:ReturnType<typeof setTimeout>;let failures=0;
    const poll=async()=>{
      if(cancelled||inFlight)return;
      inFlight=true;
      if(!document.hidden){try{await load(room.code);failures=0;}catch{if(!cancelled){setConnected(false);failures++;}}}
      inFlight=false;
      if(!cancelled)timer=setTimeout(poll,Math.min(3000*(failures+1),15000));
    };
    timer=setTimeout(poll,3000);
    const wake=()=>{setReveal(false);if(!document.hidden){clearTimeout(timer);void poll();}};
    document.addEventListener("visibilitychange",wake);
    return()=>{cancelled=true;clearTimeout(timer);document.removeEventListener("visibilitychange",wake);};
  },[room?.code,load]);
  useEffect(()=>{const hide=()=>setReveal(false);window.addEventListener("blur",hide);window.addEventListener("pagehide",hide);return()=>{window.removeEventListener("blur",hide);window.removeEventListener("pagehide",hide);};},[]);
  useEffect(()=>{setReveal(false);setSeen(false);},[room?.meId,room?.identity?.role]);
  useEffect(()=>{
    if(!share||!room)return;let cancelled=false;setQr("");
    import("qrcode").then(QR=>QR.toDataURL(`${location.origin}/?room=${room.code}`,{width:280,margin:2,color:{dark:"#101c22",light:"#ffffff"},errorCorrectionLevel:"M"})).then(data=>{if(!cancelled)setQr(data);}).catch(()=>{if(!cancelled)setError("二维码暂时生成失败，可以直接分享房间码。");});
    return()=>{cancelled=true;};
  },[share,room?.code]);
  const act=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
    if(busyRef.current)return null;busyRef.current=true;setBusy(true);setError("");
    try{
      const data=await request("/api/room",{action,code:currentCode.current,...extra}) as RoomView;
      if(action==="create"){currentCode.current=data.code;latest.current=null;createId.current="";}
      if(action==="leave"){
        currentCode.current="";latest.current=null;setRoom(null);setCode("");setReveal(false);history.replaceState(null,"","/");try{localStorage.removeItem("avalon:last-room");}catch{};return data;
      }
      accept(data);
      if(data.meId){history.replaceState(null,"",`/?room=${data.code}`);try{localStorage.setItem("avalon:last-room",data.code);localStorage.setItem("avalon:nickname",String(extra.name||name));}catch{}}
      return data;
    }catch(e){setError((e as Error).name==="TimeoutError"?"连接超时，请重试。已完成的操作不会重复执行。":(e as Error).message);return null;}
    finally{busyRef.current=false;setBusy(false);}
  },[accept,name]);
  const lookup=async()=>{
    if(!/^\d{6}$/.test(code)){setError("请输入 6 位房间码。");return;}
    setBusy(true);setError("");currentCode.current=code;latest.current=null;
    try{await load(code);history.replaceState(null,"",`/?room=${code}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const back=()=>{currentCode.current="";latest.current=null;setRoom(null);setError("");setReveal(false);history.replaceState(null,"","/");try{localStorage.removeItem("avalon:last-room");}catch{}};
  const create=async()=>{createId.current ||= crypto.randomUUID();await act("create",{name,capacity,preset,requestId:createId.current});};
  const me=room?.players.find(p=>p.id===room.meId),isHost=!!me&&room?.hostId===me.id;
  const allReady=!!room&&room.players.length===room.capacity&&room.players.every(p=>p.ready);
  const identity=room?.identity,confirmedCount=room?.players.filter(p=>p.confirmed).length??0;
  const safeRead=useCallback(()=>{
    const data=latest.current;if(!data)return {inRoom:false};
    return {inRoom:!!data.meId,code:data.code,capacity:data.capacity,phase:data.phase,players:data.players.map(p=>({name:p.name,seat:p.seat,ready:p.ready,confirmed:p.confirmed}))};
  },[]);
  useEffect(()=>{
    const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
    if(!context?.registerTool)return;const lifecycle=new AbortController();
    try{void Promise.resolve(context.registerTool({name:"read_roundtable_lobby",title:"查看圆桌公开状态",description:"读取当前房间的公开座位与准备状态，不返回任何玩家身份或私密线索。",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input:unknown){if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length)throw new Error("This tool takes an empty object.");return safeRead();}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[safeRead]);
  return <main className="app-shell"><header className="topbar"><Brand onHome={back}/><div className="header-right"><span className="edition">线下阿瓦隆助手</span><button className="icon-button" aria-label="使用说明" onClick={()=>setHelp(true)}><CircleHelp size={19}/></button></div></header>
    {error&&<div className="error-banner" role="alert">{error}<button aria-label="关闭提示" onClick={()=>setError("")}>×</button></div>}
    {!room?<div className="home-layout"><section className="entry-panel"><span className="eyebrow">THE ROUND TABLE</span><h1>朋友到齐，<br/><span>即刻入座。</span></h1><p className="intro">面对面讨论，身份交给圆桌。</p><Tabs value={mode} onValueChange={v=>{setMode(v as Mode);setError("");}} className="entry-tabs"><TabsList className="entry-tab-list"><TabsTrigger value="create">建立房间</TabsTrigger><TabsTrigger value="join">加入房间</TabsTrigger></TabsList>
      <TabsContent value="create"><form className="form-stack" onSubmit={e=>{e.preventDefault();void create();}}><label className="field">你的昵称<input autoComplete="nickname" placeholder="大家怎么称呼你" maxLength={12} required value={name} onChange={e=>setName(e.target.value)}/></label><fieldset><legend>这次有几位朋友？</legend><RadioGroup aria-label="游戏人数" className="count-grid" value={String(capacity)} onValueChange={v=>{setCapacity(Number(v));if(Number(v)<PRESETS[preset].minimum)setPreset("classic");createId.current="";}}>{[5,6,7,8,9,10].map(n=><label className={`count-option ${capacity===n?"selected":""}`} key={n}><RadioGroupItem value={String(n)} className="sr-only"/><strong>{n}</strong><span>人</span></label>)}</RadioGroup></fieldset><fieldset><legend>选择角色配置</legend><RadioGroup aria-label="角色配置" value={preset} onValueChange={v=>{setPreset(v as Preset);createId.current="";}} className="preset-grid">{(Object.keys(PRESETS) as Preset[]).map(key=><label className={`preset-choice ${key===preset?"selected":""} ${capacity<PRESETS[key].minimum?"unavailable":""}`} key={key}><RadioGroupItem value={key} disabled={capacity<PRESETS[key].minimum}/><div><strong>{PRESETS[key].name}</strong><span>{PRESETS[key].hint}</span></div></label>)}</RadioGroup></fieldset><button className="primary-button" disabled={busy||!sessionReady}>{busy?"正在建立…":"建立圆桌"}<ArrowRight size={19}/></button><p className="form-note"><KeyRound size={14}/>无需注册，扫码即可加入</p></form></TabsContent>
      <TabsContent value="join"><form className="form-stack" onSubmit={e=>{e.preventDefault();void lookup();}}><label className="field">房间码<input className="code-input" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" required placeholder="输入 6 位房间码" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label><button className="primary-button" disabled={busy||!sessionReady}>{busy?"正在寻找…":"找到圆桌"}<ArrowRight size={19}/></button><p className="form-note">也可以直接扫描房主的二维码</p></form></TabsContent></Tabs></section><section className="table-panel"><div className="table-caption"><span>今晚的圆桌</span><span><Users size={15}/>{capacity} 人局</span></div><Table count={capacity}/><div className="alignment-line"><span>{capacity-EVIL_COUNTS[capacity]} 位好人</span><span>{EVIL_COUNTS[capacity]} 位坏人</span></div><RoleChips count={capacity} preset={preset}/><div className="table-notes"><div><span>01</span><p>扫码入座</p></div><div><span>02</span><p>私密看身份</p></div><div><span>03</span><p>开始线下游戏</p></div></div><p className="privacy-note"><Shield size={15}/>你的身份，只向你揭晓</p></section></div>:
    <section className="room-page"><div className="room-heading"><div><span className="eyebrow">{room.phase==="lobby"?"TAKE YOUR SEAT":"YOUR SECRET"}</span><h1>{room.phase==="lobby"?"围坐，等待朋友。":room.phase==="ready"?"身份就绪，开始推理。":"请查看你的身份。"}</h1><p className="room-meta">房间 <strong>{room.code}</strong><span>·</span>{room.capacity} 人 · {PRESETS[room.preset].name}</p></div><button className="secondary-button" onClick={()=>setShare(true)}><QrCode size={18}/>邀请朋友</button></div>
      {!connected&&<div className="connection-banner" role="status"><RefreshCw size={16}/>连接暂时中断，正在重连。座位和身份会保留。<button onClick={()=>void load(room.code).catch(()=>setConnected(false))}>立即重试</button></div>}
      <div className="room-layout"><section className="table-panel room-table"><div className="table-caption"><span>{room.phase==="lobby"?"按实际座位入座":"座位已锁定"}</span><span>{room.phase==="lobby"?`${room.players.filter(p=>p.ready).length} 人已准备`:`${confirmedCount} / ${room.capacity} 人已确认`}</span></div><Table count={room.capacity} room={room} disabled={busy||!sessionReady||room.phase!=="lobby"} onSeat={seat=>{if(me)void act("seat",{seat});else if(!name.trim())setError("先填写昵称，再选择一个空位。");else void act("join",{seat,name});}}/><p className="table-hint">{room.phase==="lobby"?me?"点击空座位可以换座，换座后需要重新准备。":"填好昵称后，点击一个空座位加入。":"所有人的身份确认完毕后，即可开始线下讨论。"}</p><div className="member-list">{room.players.map(p=><div key={p.id}><span className="member-seat">{p.seat}</span><span className="member-name">{p.name}{p.id===room.meId&&<small>我</small>}{p.id===room.hostId&&<Crown size={14} aria-label="房主"/>}</span><span className={`member-status ${(room.phase==="lobby"?p.ready:p.confirmed)?"done":""}`}>{room.phase==="lobby"?(p.ready?"已准备":"未准备"):(p.confirmed?"已确认":"待确认")}</span></div>)}</div></section>
      <aside className="room-side">
        {!me?<section className="action-card"><span className="eyebrow">JOIN THE TABLE</span><h2>给自己留个座位</h2>{room.phase==="lobby"?<><label className="field">你的昵称<input maxLength={12} autoComplete="nickname" placeholder="大家怎么称呼你" value={name} onChange={e=>setName(e.target.value)}/></label><p className="muted-copy">在圆桌上选一个空位，就能加入朋友的房间。</p></>:<p className="muted-copy">本局已经发身份，无法中途加入。原玩家请使用入座时的浏览器返回。</p>}<button className="text-button" onClick={back}><ArrowLeft size={16}/>返回首页</button></section>:
        room.phase==="lobby"?<section className="action-card"><span className="eyebrow">YOUR SEAT · {String(me.seat).padStart(2,"0")}</span><h2>{me.name}，入座了。</h2><p className="muted-copy">确认座位后点击准备。等全员到齐，由房主统一发身份。</p><button className={me.ready?"secondary-button wide":"primary-button"} disabled={busy||!connected} onClick={()=>void act("ready",{ready:!me.ready})}>{me.ready?<><Check size={18}/>已准备 · 点击取消</>:"我准备好了"}</button>{isHost&&<><div className="divider"/><button className="primary-button" disabled={busy||!allReady||!connected} onClick={()=>setConfirmStart(true)}><Shield size={18}/>发身份</button><p className="action-note">{room.players.length<room.capacity?`还差 ${room.capacity-room.players.length} 位朋友入座`:!allReady?"等待全员准备":"所有人已准备，可以发身份"}</p></>}<button className="text-button subtle" onClick={()=>setConfirmLeave(true)} disabled={busy}><LogOut size={15}/>离开房间</button></section>:
        <section className="action-card identity-card"><span className="eyebrow">PRIVATE · 仅你可见</span><h2>{me.seat} 号的秘密</h2><div className={`identity-surface ${reveal?"revealed":""}`} aria-live="off">{reveal&&identity?<><span className={`side-label ${identity.side}`}>{identity.side==="good"?"正义阵营":"邪恶阵营"}</span><h3>{ROLES[identity.role].name}</h3><p>{ROLES[identity.role].description}</p><div className="identity-clues"><strong>你知道的线索</strong>{identity.known.map(p=><div className="clue" key={p.seat}><span>{p.seat} 号</span><b>{p.name}</b><small>{p.label}</small></div>)}<p>{identity.note}</p></div></>:<div className="sealed"><LockKeyhole size={42} strokeWidth={1.2}/><strong>身份已密封</strong><p>确认周围没有人在看你的屏幕</p></div>}</div><button className="reveal-button" disabled={!identity} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setReveal(true);setSeen(true);}} onPointerUp={()=>setReveal(false)} onPointerCancel={()=>setReveal(false)} onLostPointerCapture={()=>setReveal(false)} onKeyDown={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();setReveal(true);setSeen(true);}}} onKeyUp={e=>{if(e.key===" "||e.key==="Enter")setReveal(false);}} onBlur={()=>setReveal(false)} onContextMenu={e=>e.preventDefault()}>{reveal?<EyeOff size={19}/>:<Eye size={19}/>}按住查看，松开隐藏</button><button className={me.confirmed?"secondary-button wide":"primary-button"} disabled={busy||me.confirmed||!seen||!connected} onClick={()=>{setReveal(false);void act("confirm");}}><Check size={18}/>{me.confirmed?"我已确认身份":"我记住了，确认身份"}</button><p className="action-note">{room.phase==="ready"?"全员已确认，不需要闭眼确认身份。":`等待 ${room.capacity-confirmedCount} 人确认身份`}</p>{room.phase==="ready"&&<div className="ready-notice"><Crown size={20}/><div><strong>由 {room.firstLeader} 号担任第一任队长</strong><p>现在可以开始线下讨论。组队与投票请暂在线下进行。</p></div></div>}</section>}
        <section className="config-card"><h3>本局角色</h3><div className="alignment-line"><span>{room.capacity-EVIL_COUNTS[room.capacity]} 位好人</span><span>{EVIL_COUNTS[room.capacity]} 位坏人</span></div><RoleChips count={room.capacity} preset={room.preset}/><p className="action-note">配置公开，身份保密。房主也看不到他人的身份。</p></section>
      </aside></div>
    </section>}
    <footer className="page-footer"><span>把秘密留在手机，把推理留在圆桌。</span><span>房间保留 24 小时 · 5–10 人</span></footer>
    <Dialog open={share} onOpenChange={setShare}><DialogContent className="share-dialog"><DialogTitle>邀请朋友入座</DialogTitle><DialogDescription>用手机相机扫码，或输入下方房间码。</DialogDescription>{qr?<img className="qr-image" src={qr} alt="加入本房间的二维码" width={240} height={240}/>:<div className="qr-loading">正在生成二维码…</div>}<div className="share-code">{room?.code}</div><button className="primary-button" onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${room?.code}`);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError("无法复制，请直接分享房间码。");}}}>{copied?<Check size={17}/>:<Copy size={17}/ >}{copied?"已复制邀请链接":"复制邀请链接"}</button><p className="action-note">每位玩家使用自己的手机与浏览器。</p></DialogContent></Dialog>
    <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}><AlertDialogContent><AlertDialogTitle>向全员发身份？</AlertDialogTitle><AlertDialogDescription>发身份后，本局的座位与角色配置会锁定。请确认所有人都已坐在对应位置。</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>再检查一下</AlertDialogCancel><AlertDialogAction onClick={()=>void act("start")}>确认发身份</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}><AlertDialogContent><AlertDialogTitle>离开这个房间？</AlertDialogTitle><AlertDialogDescription>你的座位会空出来。若你是房主，管理权会交给下一位玩家。</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>继续等朋友</AlertDialogCancel><AlertDialogAction onClick={()=>void act("leave")}>离开房间</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogTitle>一起围坐，秘密入局</DialogTitle><DialogDescription>每人用一部联网手机，无需注册账号。</DialogDescription><ol className="help-list"><li>房主选择人数和角色配置，建立房间。</li><li>朋友扫码或输入房间码，填写昵称，按实际位置选择座位。</li><li>全员准备后，房主发身份。按住查看你的身份和线索，松开即隐藏。</li><li>全员确认后开始线下讨论。当前支持入座与身份分发，组队和投票暂在线下进行。</li></ol><p className="muted-copy">刷新或锁屏不会改变身份。请使用原来的浏览器返回；清除本站 Cookie 或换浏览器后，无法仅凭昵称找回身份。房间在创建 24 小时后过期。</p></DialogContent></Dialog>
  </main>;
}
