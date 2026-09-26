"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Shield, Users, Crown, KeyRound, Check, Copy, QrCode, Eye, EyeOff, RefreshCw, LogOut, LockKeyhole, CircleHelp, Smartphone, LoaderCircle, Bookmark, X, Monitor } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ROLES, PRESETS, rolePool, EVIL_COUNTS, CUSTOM_GOOD_ROLES, CUSTOM_EVIL_ROLES, type Preset, type Role, type RoomView } from "@/lib/game";
import { GamePanel } from "@/components/game-panel";
import { ActionDock } from "@/components/action-dock";
import { InstallApp } from "@/components/install-app";
import { PushToggle } from "@/components/push-toggle";
import { RoomManagement } from "@/components/room-management";
import { RoomProgress } from "@/components/room-progress";
import { RecoveryCodeCard, SeatRecovery } from "@/components/device-recovery";
import { TakeoverAlert, TakeoverRequests } from "@/components/takeover-requests";
import { PlayerNotesPanel } from "@/components/player-notes";
import { RevealOverlay } from "@/components/reveal-overlay";
import { useTurnReminder } from "@/components/turn-reminder";
import { myTurn } from "@/lib/turn";
import { BoardRulesButton } from "@/components/rules-card";
import { RoomRecord } from "@/components/room-record";
import { ThemeToggle } from "@/components/theme-toggle";
import { Brand, RoleChips, SeatTable as Table } from "@/components/seat-table";
import { HelpDialog } from "@/components/help-dialog";
import { ensureSession, rememberInvite, request } from "@/lib/room-client";
import { useRoomSync } from "@/lib/use-room-sync";
import { submitDelivery } from "@/lib/submit-status";
import { BUILT_IN_TEMPLATES, MAX_SAVED_TEMPLATES, MAX_TEMPLATE_NAME, fillCustomRoles, loadSavedTemplates, newTemplateId, sameBoard, storeSavedTemplates, templateFits, templateMinimum, type BoardTemplate } from "@/lib/board-templates";
import { useI18n } from "@/lib/i18n/react";
import { msg, type Vars } from "@/lib/i18n/core";
import { LangToggle } from "@/components/lang-toggle";
import { HOST_KEY_LENGTH, formatHostKey, formattedCaret, hostKeyCharacters, hostKeyForSubmit } from "@/lib/host-key-input";
import { isControlHost } from "@/lib/solo";
import { achievementById } from "@/lib/achievements";
import { AccountGate, type SignedAccount } from "@/components/account-gate";
import { AccountProfile } from "@/components/account-profile";

type Mode="create"|"join";
function roomPath(code:string){
  const params=new URLSearchParams(location.search),solo=params.get("solo");
  if(!solo||!/^[a-f0-9]{64}$/.test(solo))return `/?room=${code}`;
  const next=new URLSearchParams({room:code,solo,soloSeat:params.get("soloSeat")??"",soloName:params.get("soloName")??""});
  return `/?${next.toString()}`;
}
// A notice keeps its Chinese source text and values, so it re-renders in the current language.
type Notice={text:string;vars?:Vars}|null;

export default function Home(){
  const {t,ts}=useI18n();
  const [mode,setMode]=useState<Mode>("create"),[name,setName]=useState(""),[hostKey,setHostKey]=useState(""),[capacity,setCapacity]=useState(8),[preset,setPreset]=useState<Preset>("classic"),[code,setCode]=useState("");
  const [customSpecials,setCustomSpecials]=useState<Set<Role>>(()=>new Set(["merlin","assassin"])),[ladyOfLake,setLadyOfLake]=useState(false),[turnSpeech,setTurnSpeech]=useState(false),[knowsOberon,setKnowsOberon]=useState(false);
  // Saved boards live on this device only. The picker renders only after the
  // host chooses a custom board, so reading storage here cannot affect hydration.
  const [savedTemplates,setSavedTemplates]=useState<BoardTemplate[]>(()=>typeof window==="undefined"?[]:loadSavedTemplates()),[templateName,setTemplateName]=useState<string|null>(null);
  const [room,setRoom]=useState<RoomView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sessionReady,setSessionReady]=useState(false),[connected,setConnected]=useState(true),[delivery,setDelivery]=useState<"saved"|"unsent"|null>(null);
  const [membershipNotice,setMembershipNotice]=useState<Notice>(null),[swapSeat,setSwapSeat]=useState<number|null>(null),[roomPanel,setRoomPanel]=useState<"table"|"identity"|"notes">("table");
  // Code of a room the server reported as expired or closed: stop syncing it.
  const [goneCode,setGoneCode]=useState("");
  const [booting,setBooting]=useState(true);
  const [share,setShare]=useState(false),[qrImage,setQrImage]=useState<{url:string;data:string}|null>(null),[copied,setCopied]=useState(false),[reveal,setReveal]=useState(false),[seen,setSeen]=useState(false),[confirmStart,setConfirmStart]=useState(false),[confirmLeave,setConfirmLeave]=useState(false),[help,setHelp]=useState(false),[menu,setMenu]=useState(false);
  const currentCode=useRef(""),createId=useRef(""),latest=useRef<RoomView|null>(null),busyRef=useRef(false),revealDrag=useRef(0);
  // Local solo desk: each *.localhost phone joins its own seat. Never set on a public host.
  const soloJoin=useRef<{seat:number;name:string}|null>(null),soloTries=useRef(0);
  const soloEmbed=useSyncExternalStore(()=>()=>{},()=>new URLSearchParams(location.search).has("solo"),()=>false);
  const openedRoom=useSyncExternalStore(()=>()=>{},()=>new URLSearchParams(location.search).has("room"),()=>false);
  const [account,setAccount]=useState<SignedAccount|null|undefined>(undefined),[guest,setGuest]=useState(false),[homeTab,setHomeTab]=useState<"play"|"me">("play");
  useEffect(()=>{
    void Promise.resolve().then(()=>setGuest(localStorage.getItem("avalon:guest")==="1"));
    void fetch("/api/account",{cache:"no-store"}).then(response=>response.json() as Promise<{account?: SignedAccount|null}>).then(data=>setAccount(data.account??null)).catch(()=>setAccount(null));
  },[]);
  // v1.8: tab title, buzz and badge when it is this player's move.
  const turn=room?myTurn(room):null;
  useTurnReminder(turn);
  const accept=useCallback((data:RoomView)=>{
    if(data.code!==currentCode.current)return;
    if(latest.current?.code===data.code&&latest.current.version>data.version)return;
    if(latest.current?.round!==data.round){setReveal(false);setSeen(false);setConfirmStart(false);setConfirmLeave(false);setError("");}
    if(latest.current?.hostId!==data.hostId||latest.current?.meId!==data.meId){setConfirmStart(false);setConfirmLeave(false);}
    const previous=latest.current;
    if(data.meId&&!previous?.meId)setMembershipNotice(null);
    if(previous?.meId&&!data.meId){
      setReveal(false);setSeen(false);
      const seat=previous.players.find(p=>p.id===previous.meId)?.seat;
      const lastAt=(list:RoomView["recoveries"]|undefined)=>Math.max(0,...(list??[]).filter(r=>r.seat===seat).map(r=>r.at));
      const moved=lastAt(data.recoveries)>lastAt(previous.recoveries);
      setMembershipNotice(moved?{text:msg("你的 {seat} 号座位已在另一台设备上恢复，这台设备不能再查看身份。如果不是你本人操作，请马上告诉房主。"),vars:{seat:seat??""}}:{text:msg("房主已将你移出房间，原座位已释放。需要继续参与时，可以重新选择空座位加入。")});
    }
    const newestRecovery=(list:RoomView["recoveries"]|undefined)=>Math.max(0,...(list??[]).map(r=>r.at));
    if(previous&&previous.code===data.code&&!previous.meId&&data.meId&&newestRecovery(data.recoveries)>newestRecovery(previous.recoveries)){
      setMembershipNotice({text:msg("已在这台设备回到 {seat} 号座位。原来的设备已失效，新的恢复码在「我的身份与圆桌座位」中。"),vars:{seat:data.players.find(p=>p.id===data.meId)?.seat??""}});
    }
    if(data.meId){rememberInvite(data.code,data.inviteToken);try{localStorage.setItem("avalon:last-room",data.code);}catch{}}
    latest.current=data;setRoom(data);setConnected(navigator.onLine!==false);
  },[]);
  const load=useCallback(async(target:string)=>{const data=await request(`/api/room?code=${encodeURIComponent(target)}`,undefined,target);accept(data);return data as RoomView;},[accept]);
  const live=useRoomSync(room,goneCode,currentCode,latest,load,setError,setConnected,setGoneCode,setReveal);
  useEffect(()=>{
    if(isControlHost(location.hostname)){
      const pending=new URLSearchParams(location.search);
      const seat=Number(pending.get("soloSeat")),soloName=pending.get("soloName")??"";
      if(Number.isInteger(seat)&&seat>=1&&seat<=10&&soloName)soloJoin.current={seat,name:soloName.slice(0,12)};
    }
    let cancelled=false;
    ensureSession().then(async()=>{
      if(cancelled)return;setSessionReady(true);
      let saved="";try{saved=localStorage.getItem("avalon:last-room")||"";setName(localStorage.getItem("avalon:nickname")||"");}catch{}
      const params=new URLSearchParams(location.search),target=params.get("room")||saved;
      if(/^\d{6}$/.test(target)){
        rememberInvite(target,params.get("invite"));
        if(params.has("invite")||params.has("solo"))history.replaceState(null,"",roomPath(target));
        currentCode.current=target;setCode(target);setMode("join");try{await load(target);}catch(e){if(!cancelled)setError((e as Error).message);}
      }
    }).catch(()=>{if(!cancelled)setError(msg("暂时无法连接圆桌。请检查网络后刷新页面。"));}).finally(()=>{if(!cancelled)setBooting(false);});
    return()=>{cancelled=true;};
  },[load]);
  useEffect(()=>{const hide=()=>setReveal(false);window.addEventListener("blur",hide);window.addEventListener("pagehide",hide);return()=>{window.removeEventListener("blur",hide);window.removeEventListener("pagehide",hide);};},[]);
  const dealtKey=room?.phase==="identity"?`${room.code}:${room.round}`:"";
  const [seenDeal,setSeenDeal]=useState(dealtKey);
  if(dealtKey&&seenDeal!==dealtKey){setSeenDeal(dealtKey);setRoomPanel("identity");}
  // Re-seal the identity card whenever the seat, role or game changes. This is
  // derived during render so a new identity is never shown for a single frame.
  const identityKey=`${room?.meId??""}:${room?.identity?.role??""}:${room?.round??0}`;
  const [sealedFor,setSealedFor]=useState(identityKey);
  if(sealedFor!==identityKey){setSealedFor(identityKey);setReveal(false);setSeen(false);}
  const inviteUrl=room?`${typeof location==="undefined"?"":location.origin}/?room=${room.code}${room.inviteToken?`&invite=${room.inviteToken}`:""}`:"";
  const qr=qrImage?.url===inviteUrl?qrImage.data:"";
  useEffect(()=>{
    if(!share||!inviteUrl)return;let cancelled=false;
    import("qrcode").then(QR=>QR.toDataURL(inviteUrl,{width:280,margin:2,color:{dark:"#101c22",light:"#ffffff"},errorCorrectionLevel:"M"})).then(data=>{if(!cancelled)setQrImage({url:inviteUrl,data});}).catch(()=>{if(!cancelled)setError(msg("二维码暂时生成失败，可以直接分享房间码。"));});
    return()=>{cancelled=true;};
  },[share,inviteUrl]);
  const act=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
    if(navigator.onLine===false){setConnected(false);setDelivery("unsent");setError(msg("网络已断开。联网后请重新提交，操作不会在后台自动发送。"));return null;}
    if(busyRef.current)return null;busyRef.current=true;setBusy(true);setError("");
    try{
      const data=await request("/api/room",{action,code:currentCode.current,round:latest.current?.round,hostRevision:latest.current?.hostRevision,...extra},currentCode.current) as RoomView;
      if(action==="create"){currentCode.current=data.code;latest.current=null;createId.current="";}
      if(action==="leave"){
        setDelivery("saved");
        currentCode.current="";latest.current=null;setRoom(null);setCode("");setReveal(false);setMembershipNotice(null);history.replaceState(null,"","/");try{localStorage.removeItem("avalon:last-room");}catch{};return data;
      }
      accept(data);
      setDelivery("saved");
      if(data.meId){history.replaceState(null,"",roomPath(data.code));try{localStorage.setItem("avalon:last-room",data.code);if(typeof extra.name==="string"||action==="create")localStorage.setItem("avalon:nickname",String(extra.name||name));}catch{}}
      return data;
    }catch(e){
      const failure=e as Error&{status?:number};
      setDelivery(submitDelivery(failure));
      if([403,409].includes(failure.status??0)&&currentCode.current)await load(currentCode.current).catch(()=>setConnected(false));
      setError(failure.name==="TimeoutError"?msg("连接超时，请重试。已完成的操作不会重复执行。"):failure.message);return null;
    }
    finally{busyRef.current=false;setBusy(false);}
  },[accept,name,load]);
  useEffect(()=>{
    const pending=soloJoin.current;
    if(!pending||!room||room.meId||room.phase!=="lobby"||busy||soloTries.current>=5)return;
    if(room.players.some(player=>player.seat===pending.seat))return;
    const timer=window.setTimeout(()=>{soloTries.current+=1;void act("join",{seat:pending.seat,name:pending.name});},pending.seat*150);
    return()=>window.clearTimeout(timer);
  },[room,act,busy]);
  const lookup=async()=>{
    if(!/^\d{6}$/.test(code)){setError(msg("请输入 6 位房间码。"));return;}
    setBusy(true);setError("");setMembershipNotice(null);currentCode.current=code;latest.current=null;
    try{await load(code);history.replaceState(null,"",`/?room=${code}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const back=()=>{currentCode.current="";latest.current=null;setRoom(null);setError("");setReveal(false);setMembershipNotice(null);history.replaceState(null,"","/");try{localStorage.removeItem("avalon:last-room");}catch{}};
  const customRoles=fillCustomRoles(capacity,customSpecials);
  const applyTemplate=(template:BoardTemplate)=>{setCustomSpecials(new Set(template.specials));setLadyOfLake(template.ladyOfLake);createId.current="";setError("");};
  const saveTemplate=()=>{
    const label=(templateName??"").trim().slice(0,MAX_TEMPLATE_NAME);
    if(!label){setError(msg("请给模板起个名字。"));return;}
    const template:BoardTemplate={id:newTemplateId(),name:label,specials:[...customSpecials],ladyOfLake};
    if(templateMinimum(template)===null){setError(msg("当前板子无法在任何人数下使用，请调整后再保存。"));return;}
    const next=[template,...savedTemplates.filter(item=>!sameBoard(item,customSpecials,ladyOfLake))].slice(0,MAX_SAVED_TEMPLATES);
    if(!storeSavedTemplates(next)){setError(msg("这台设备无法保存模板（可能处于无痕模式）。"));return;}
    setSavedTemplates(next);setTemplateName(null);setError("");
  };
  const deleteTemplate=(id:string)=>{const next=savedTemplates.filter(item=>item.id!==id);storeSavedTemplates(next);setSavedTemplates(next);};
  const previewRoles=preset==="custom"?customRoles:rolePool(capacity,preset);
  const toggleCustomRole=(role:Role)=>{if(role==="merlin"||role==="assassin")return;setCustomSpecials(current=>{
    const next=new Set(current),adding=!next.has(role),paired:Role[]=[];
    if(role==="goodLancelot"||role==="evilLancelot")paired.push("goodLancelot","evilLancelot");else paired.push(role);
    if(adding){for(const item of paired)next.add(item);if(role==="morgana")next.add("percival");}
    else{for(const item of paired)next.delete(item);if(role==="percival")next.delete("morgana");if(role==="oberon")setKnowsOberon(false);}
    const good=[...next].filter(item=>ROLES[item].side==="good").length,evil=[...next].filter(item=>ROLES[item].side==="evil").length;
    return good<=capacity-EVIL_COUNTS[capacity]&&evil<=EVIL_COUNTS[capacity]?next:current;
  });createId.current="";};
  // The field holds only the 16 key characters; it displays them in groups of
  // four and keeps the caret beside the character the host just typed.
  const onHostKeyChange=(event:ChangeEvent<HTMLInputElement>)=>{
    const input=event.target,caret=input.selectionStart??input.value.length;
    const typed=hostKeyCharacters(input.value);
    let body=typed.slice(0,HOST_KEY_LENGTH),before=Math.min(hostKeyCharacters(input.value.slice(0,caret)).length,body.length);
    // Once all 16 characters are in, further typing is ignored instead of
    // pushing characters off the end.
    if(typed.length>HOST_KEY_LENGTH&&hostKey.length===HOST_KEY_LENGTH){body=hostKey;before=Math.max(0,before-(typed.length-HOST_KEY_LENGTH));}
    // Backspace over an inserted hyphen removes the key character before it.
    else if(body===hostKey&&input.value.length<formatHostKey(hostKey).length&&before>0){body=body.slice(0,before-1)+body.slice(before);before--;}
    setHostKey(body);
    requestAnimationFrame(()=>{if(document.activeElement===input){const position=formattedCaret(before);input.setSelectionRange(position,position);}});
  };
  const create=async()=>{
    if(account&&!account.canHost){setError(t("普通账号不能直接开房。请用高级账号，或先用游客模式加入朋友的房间。"));return;}
    if(!account?.canHost&&hostKey.length!==HOST_KEY_LENGTH){setError(t("房主 Key 是 {total} 位字母和数字，现在输入了 {n} 位。",{total:HOST_KEY_LENGTH,n:hostKey.length}));return;}
    createId.current ||= crypto.randomUUID();const boardHasOberon=preset==="full"||(preset==="custom"&&customSpecials.has("oberon"));const created=await act("create",{name,hostKey:hostKeyForSubmit(hostKey),capacity,preset,turnSpeech,evilSeesOberon:boardHasOberon&&knowsOberon,...(preset==="custom"?{roles:customRoles,ladyOfLake}:{}),requestId:createId.current});if(created)setHostKey("");};
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
    try{void Promise.resolve(context.registerTool({name:"read_roundtable_lobby",title:msg("查看圆桌公开状态"),description:msg("读取当前房间的公开座位与准备状态，不返回任何玩家身份或私密线索。"),inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input:unknown){if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length)throw new Error("This tool takes an empty object.");return safeRead();}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[safeRead]);
  if(!soloEmbed&&!openedRoom&&!room&&account===null&&!guest)return <AccountGate onLogin={next=>{localStorage.removeItem("avalon:guest");setGuest(false);setAccount(next);}} onGuest={()=>{localStorage.setItem("avalon:guest","1");setGuest(true);}}/>;
  return <main className={`app-shell ${room ? "is-room" : "is-home"}${soloEmbed ? " is-solo-embed" : ""}`}>
    <header className="topbar">
      <Brand onOpen={()=>setMenu(true)}/>
      <div className="header-right">
        <span className="edition"><span className="status-dot"/>{t("面对面，才有意思")}</span>
        {room&&<BoardRulesButton room={room}/>}
        <ThemeToggle/><LangToggle/>
        <InstallApp/>
        {room?.meId && <PushToggle seated act={act}/>}
        <button className="icon-button" aria-label={t("使用说明")} onClick={()=>setHelp(true)}><CircleHelp size={20}/></button>
      </div>
    </header>

    {error&&(room||booting)&&<div className="error-banner" role="alert"><span>{ts(error)}</span><button aria-label={t("关闭提示")} onClick={()=>setError("")}>×</button></div>}

    {booting ? <section className="connection-splash" aria-live="polite"><span className="splash-emblem"><Crown size={32}/></span><h1>{t("圆桌正在就位")}</h1><p><LoaderCircle size={16} className="spin"/>{t("正在连接，恢复你的房间…")}</p></section> : !room ? <div className="home-layout">
      <section className="home-intro">
        <div className="eyebrow">{account?.title ? <span className={`worn-title${achievementById(account.title)?.mark ? ` is-${achievementById(account.title)?.mark}` : ""}`}>{t(achievementById(account.title)?.name ?? account.title)}</span> : <><span className="eyebrow-line"/>THE ROUND TABLE</>}</div>
        <h1>{t("让秘密归位，")}<br/><span>{t("让推理发生。")}</span></h1>
        <p className="intro">{t("和朋友围坐在一起。")}<br/>{t("身份、投票与任务，让圆桌替你记住。")}</p>
        <div className="home-benefits"><span><KeyRound size={15}/>{t("无需注册")}</span><span><Shield size={15}/>{t("私密身份")}</span><span><Smartphone size={15}/>{t("手机即用")}</span></div>
      </section>

      <section className="entry-panel" aria-label={t("进入圆桌")}>
        <div className="entry-card-heading"><div><span className="entry-kicker">YOUR NEXT GAME NIGHT</span><h2>{mode==="create"?t("今晚，坐在一起。"):t("朋友正在等你。")}</h2></div><Crown size={26} strokeWidth={1.25}/></div>
        <Tabs value={mode} onValueChange={v=>{setMode(v as Mode);setError("");if(v==="join")setHostKey("");}} className="entry-tabs">
          <TabsList className="entry-tab-list"><TabsTrigger value="create">{t("建立房间")}</TabsTrigger><TabsTrigger value="join">{t("加入房间")}</TabsTrigger></TabsList>
          <TabsContent value="create">
            <form className="form-stack" onSubmit={e=>{e.preventDefault();void create();}}>
                            <fieldset><legend>{t("这次有几位朋友？")}</legend><RadioGroup aria-label={t("游戏人数")} className="count-grid" value={String(capacity)} onValueChange={v=>{const next=Number(v);setCapacity(next);if(!templateFits({specials:[...customSpecials],ladyOfLake},next)){setCustomSpecials(new Set(["merlin","assassin"]));setLadyOfLake(false);setKnowsOberon(false);}if(next<PRESETS[preset].minimum)setPreset("classic");createId.current="";}}>{[5,6,7,8,9,10].map(n=><label className={`count-option ${capacity===n?"selected":""}`} key={n}><RadioGroupItem value={String(n)} className="sr-only"/><strong>{n}</strong><span>{t("人")}</span></label>)}</RadioGroup></fieldset>
              <fieldset><legend>{t("选择角色配置")}</legend><RadioGroup aria-label={t("角色配置")} value={preset} onValueChange={v=>{setPreset(v as Preset);createId.current="";}} className="preset-grid">{(Object.keys(PRESETS) as Preset[]).map(key=><label className={`preset-choice ${key===preset?"selected":""} ${capacity<PRESETS[key].minimum?"unavailable":""}`} key={key}><RadioGroupItem value={key} disabled={capacity<PRESETS[key].minimum}/><div><strong>{t(PRESETS[key].name)}</strong><span>{t(PRESETS[key].hint)}</span></div></label>)}</RadioGroup></fieldset>
              <fieldset className="template-picker"><legend>{t("推荐板子")}<small>{t("一键套用，之后还能微调")}</small></legend><div className="template-chips">{[...BUILT_IN_TEMPLATES,...savedTemplates].map(template=>{const fits=templateFits(template,capacity),active=preset==="custom"&&sameBoard(template,customSpecials,ladyOfLake);return <span key={template.id} className={`template-chip${active?" selected":""}${template.builtIn?"":" mine"}`}><button type="button" disabled={!fits} aria-pressed={active} onClick={()=>{setPreset("custom");applyTemplate(template);}}><span>{template.builtIn?t(template.name):template.name}</span><small>{fits?(template.hint?t(template.hint):template.ladyOfLake?t("我的模板 · 湖中仙女"):t("我的模板")):t("{n} 人起",{n:templateMinimum(template)??""})}</small></button>{!template.builtIn&&<button type="button" className="template-delete" aria-label={t("删除模板「{name}」",{name:template.name})} onClick={()=>deleteTemplate(template.id)}><X size={14}/></button>}</span>;})}</div></fieldset>
              {preset==="custom"&&<fieldset className="custom-board"><legend>{t("编辑自定义板子")}</legend><div className="custom-board-summary"><span>{t("正义 {n} 位",{n:capacity-EVIL_COUNTS[capacity]})}</span><span>{t("邪恶 {n} 位",{n:EVIL_COUNTS[capacity]})}</span><small>{t("空余位置自动补为忠臣或爪牙")}</small></div><div className="custom-role-columns"><div><strong>{t("正义角色")}</strong>{CUSTOM_GOOD_ROLES.map(role=><button type="button" key={role} className={customSpecials.has(role)?"selected":""} aria-pressed={customSpecials.has(role)} disabled={role==="merlin"||(capacity<7&&["goodLancelot","cleric"].includes(role))} onClick={()=>toggleCustomRole(role)}><span>{t(ROLES[role].name)}</span><small>{role==="merlin"?t("必选"):role==="goodLancelot"?t("与邪恶兰斯洛特成对"):t("可选")}</small></button>)}</div><div><strong>{t("邪恶角色")}</strong>{CUSTOM_EVIL_ROLES.map(role=><button type="button" key={role} className={customSpecials.has(role)?"selected":""} aria-pressed={customSpecials.has(role)} disabled={role==="assassin"||(capacity<7&&["evilLancelot","lunatic","brute","revealer"].includes(role))} onClick={()=>toggleCustomRole(role)}><span>{t(ROLES[role].name)}</span><small>{role==="assassin"?t("必选"):role==="evilLancelot"?t("成对加入"):role==="morgana"?t("需派西维尔"):t("可选")}</small></button>)}</div></div><label className={`module-toggle ${capacity<7?"disabled":""}`}><input type="checkbox" checked={ladyOfLake} disabled={capacity<7} onChange={e=>{setLadyOfLake(e.target.checked);createId.current="";}}/><span><strong>{t("启用湖中仙女")}</strong><small>{t("第 2、3、4 次任务后，持有者私密查验一位玩家的阵营")}</small></span></label><div className="template-save-row">{templateName===null?<button type="button" className="template-save" onClick={()=>setTemplateName("")}><Bookmark size={15}/>{t("保存当前板子为模板")}</button>:<div className="template-save-form"><input autoFocus aria-label={t("模板名称")} placeholder={t("模板名称，最多 {n} 字",{n:MAX_TEMPLATE_NAME})} maxLength={MAX_TEMPLATE_NAME} value={templateName} onChange={e=>setTemplateName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();saveTemplate();}if(e.key==="Escape")setTemplateName(null);}}/><button type="button" className="template-save-confirm" onClick={saveTemplate}>{t("保存")}</button><button type="button" className="template-save-cancel" onClick={()=>setTemplateName(null)}>{t("取消")}</button></div>}{savedTemplates.length>0&&<small>{t("我的模板只保存在这台设备（{n}/{max}）",{n:savedTemplates.length,max:MAX_SAVED_TEMPLATES})}</small>}</div></fieldset>}
              <label className="module-toggle"><input type="checkbox" checked={turnSpeech} onChange={e=>{setTurnSpeech(e.target.checked);createId.current="";}}/><span><strong>{t("轮流发言")}</strong><small>{t("每人说完要点「我说完了」，并可以计时。不勾选时，队长亮车，大家讨论完直接表决。")}</small></span></label>
              <label className={`module-toggle ${preset==="full"||(preset==="custom"&&customSpecials.has("oberon"))||((preset==="custom"?[...customSpecials]:["merlin","assassin"] as Role[]).filter(role=>ROLES[role].side==="evil").length<EVIL_COUNTS[capacity])?"":"disabled"}`}><input type="checkbox" checked={knowsOberon} disabled={!(preset==="full"||(preset==="custom"&&customSpecials.has("oberon"))||((preset==="custom"?[...customSpecials]:["merlin","assassin"] as Role[]).filter(role=>ROLES[role].side==="evil").length<EVIL_COUNTS[capacity]))} onChange={e=>{createId.current="";if(!e.target.checked){setKnowsOberon(false);return;}if(!(preset==="full"||(preset==="custom"&&customSpecials.has("oberon")))){const base=preset==="custom"?new Set(customSpecials):new Set<Role>(["merlin","assassin"]);if([...base].filter(role=>ROLES[role].side==="evil").length>=EVIL_COUNTS[capacity])return;base.add("oberon");setPreset("custom");setCustomSpecials(base);}setKnowsOberon(true);}}/><span><strong>{t("坏人认识奥伯伦")}</strong><small>{t("坏人知道奥伯伦是谁，奥伯伦不知道队友。勾选后会把奥伯伦加入板子。")}</small></span></label>
              <label className="field"><span className="field-label">{t("你的昵称")}</span><input autoComplete="nickname" placeholder={t("大家怎么称呼你")} maxLength={12} required value={name} onChange={e=>setName(e.target.value)}/></label>
              {account?.canHost?null:<label className="field host-key-field"><span className="host-key-label"><span><KeyRound size={14}/>{t("房主 Key")}</span><small aria-live="polite">{hostKey?t("{n} / {total} 位",{n:hostKey.length,total:HOST_KEY_LENGTH}):t("仅创建房间需要")}</small></span><span className="host-key-input"><span className="host-key-prefix" aria-hidden="true">AVL-</span><input type="text" name="avalon-host-key" inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={40} required aria-label={t("房主 Key：16 位字母和数字，不含 0、1、I、O")} value={formatHostKey(hostKey)} onChange={onHostKeyChange}/></span></label>}
              {error&&<p className="entry-error" role="alert">{ts(error)}</p>}
              <div className="entry-submit"><button className="primary-button" disabled={busy||!sessionReady}>{busy?<><LoaderCircle size={18} className="spin"/>{t("正在建立…")}</>:<>{t("建立圆桌")}<ArrowRight size={18}/></>}</button><p className="form-note"><LockKeyhole size={13}/>{t("房主凭 Key 建房，朋友扫码即可入座")}</p></div>
            </form>
          </TabsContent>
          <TabsContent value="join">
            <form className="form-stack join-form" onSubmit={e=>{e.preventDefault();void lookup();}}>
              <div className="join-intro"><span><QrCode size={26} strokeWidth={1.4}/></span><p>{t("输入朋友分享的房间码，")}<br/>{t("把今晚的座位留给自己。")}</p></div>
              <label className="field">{t("房间码")}<input className="code-input" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" required placeholder={t("6 位房间码")} maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label>
              {error&&<p className="entry-error" role="alert">{ts(error)}</p>}
              <button className="primary-button" disabled={busy||!sessionReady}>{busy?<><LoaderCircle size={18} className="spin"/>{t("正在寻找…")}</>:<>{t("找到圆桌")}<ArrowRight size={18}/></>}</button>
              <p className="form-note">{t("也可以用手机相机扫描房主的二维码")}</p>
            </form>
          </TabsContent>
        </Tabs>
      </section>

      <section className="table-panel showcase" aria-label={t("当前角色配置预览")}>
        <div className="table-caption"><span>{t("今晚的圆桌")}</span><span><Users size={14}/>{t("{n} 人",{n:capacity})} · {t(PRESETS[preset].name)}</span></div>
        <Table count={capacity}/>
        <div className="showcase-roster"><div className="alignment-line"><span><i/>{t("{n} 位好人",{n:capacity-EVIL_COUNTS[capacity]})}</span><span><i/>{t("{n} 位坏人",{n:EVIL_COUNTS[capacity]})}</span></div><RoleChips roles={previewRoles}/>{preset==="custom"&&ladyOfLake&&<p className="module-badge">{t("湖中仙女 · 已启用")}</p>}</div>
        <p className="privacy-note"><Shield size={14}/>{t("身份由系统私密分发，房主也无法提前查看。")}</p>
      </section>
    </div> : <section className={`room-page${!room.game&&roomPanel==="table"?" is-lobby":""}${room.game&&roomPanel==="table"?" is-play":""}${roomPanel==="notes"?" is-notes":""}${roomPanel==="identity"?" is-identity":""}`}>
      {delivery==="unsent"&&<div className="connection-banner" role="status"><RefreshCw size={17}/><span>{t("上一动作没送出，请再按一次。已经成功的操作不会重复执行。")}</span></div>}
      {!connected&&delivery!=="unsent"&&<div className="connection-banner" role="status"><RefreshCw size={17}/><span>{delivery==="saved"?t("正在重连。刚才的操作已经在服务器上，座位和身份也还在。"):t("连接暂时中断，座位和身份保存在服务器上，恢复网络后自动同步。换了设备可以用恢复码回到座位。")}</span><button onClick={()=>void load(room.code).catch(()=>setConnected(false))}>{t("立即重试")}</button></div>}
      {membershipNotice&&<div className="membership-notice dismissible" role="status"><p>{t(membershipNotice.text,membershipNotice.vars)}</p><button type="button" aria-label={t("关闭提示")} onClick={()=>setMembershipNotice(null)}>×</button></div>}
      {room.phase==="lobby"&&room.resetReason==="abort"&&<p className="membership-notice" role="status">{t("上一局已由房主作废，身份和记录已清除。玩家与座位已保留，请重新准备；需要补位时可由房主移除离场玩家。")}</p>}
      <p className="sr-only" role="status" aria-live="polite">{turn?t(turn):""}</p>{room.game&&<RevealOverlay key={room.round} room={room}/>}
      <TakeoverAlert room={room} busy={busy} connected={connected} act={act}/>
      <TakeoverRequests room={room} busy={busy} connected={connected} act={act}/>
      <RoomProgress room={room} connected={connected} live={live}/>
      <nav className="room-panel-nav" aria-label={t("房间分区")}>
        <button type="button" className={roomPanel==="table"?`active${turn?" your-turn":""}`:turn?"your-turn":""} aria-current={roomPanel==="table"?"page":undefined} onClick={()=>setRoomPanel("table")}>{t("主界面")}</button>
        <button type="button" className={roomPanel==="identity"?"active":""} aria-current={roomPanel==="identity"?"page":undefined} onClick={()=>setRoomPanel("identity")}>{t("身份牌")}</button>
        <button type="button" className={roomPanel==="notes"?"active":""} aria-current={roomPanel==="notes"?"page":undefined} onClick={()=>setRoomPanel("notes")}>{t("笔记")}</button>
      </nav>
      <div className="room-fit">
      <div hidden={roomPanel!=="table"}>
      <GamePanel key={`${room.round}:${room.game?.turnId??"pregame"}`} room={room} busy={busy} connected={connected} error={error} act={act} onNewGame={back}/>
      {!room.game&&<div className="room-layout">
          <section className="table-panel room-table">
            <div className="table-caption"><span><Users size={16}/>{room.phase==="lobby"?t("按实际座位入座"):t("今晚的同桌")}</span><span>{t("{n} / {count} 人",{n:room.players.length,count:room.capacity})}</span></div>
            {room.phase==="lobby"&&!me&&<div className="lobby-join"><label className="field">{t("你的昵称")}<input maxLength={12} autoComplete="nickname" placeholder={t("大家怎么称呼你")} value={name} onChange={e=>setName(e.target.value)}/></label>{room.namesHidden&&<p className="action-note"><LockKeyhole size={13}/>{t("通过房间码进入时不显示昵称；扫描房主的二维码可看到完整座位信息。")}</p>}</div>}
            <div className="table-slot"><Table count={room.capacity} room={room} disabled={busy||!sessionReady||!connected||room.phase!=="lobby"} onSeat={seat=>{
              const taken=room.players.find(p=>p.seat===seat);
              if(me){if(taken&&taken.id!==me.id)setSwapSeat(seat);else void act("seat",{seat});}
              else if(!name.trim())setError(msg("先填写昵称，再选择一个空位。"));
              else if(taken)setError(msg("这个号已经有人。先坐一个空位，再点这个号申请互换。"));
              else void act("join",{seat,name});
            }} /></div>
            {room.phase==="lobby"&&room.seatSwapOut&&<p className="membership-notice" role="status">{t("已向 {name} 申请换成 {n} 号。",{name:room.seatSwapOut.name,n:room.seatSwapOut.seat})} <button type="button" className="text-button" disabled={busy||!connected} onClick={()=>void act("swap-cancel")}>{t("取消申请")}</button></p>}
            {room.phase==="lobby"&&room.seatSwapIn.map(ask=><p className="membership-notice" role="status" key={ask.id}>{t("{name} 想和你换号：你到 {from} 号，对方到 {to} 号。",{name:ask.name,from:ask.fromSeat,to:ask.seat})} <button type="button" className="text-button" disabled={busy||!connected} onClick={()=>void act("swap-accept",{requestId:ask.id})}>{t("同意互换")}</button><button type="button" className="text-button subtle" disabled={busy||!connected} onClick={()=>void act("swap-reject",{requestId:ask.id})}>{t("拒绝")}</button></p>)}
            {room.phase==="lobby"&&me&&<div className="lobby-ready">
              {isHost&&allReady
                ? <button className="primary-button" disabled={busy||!connected} onClick={()=>setConfirmStart(true)}><Shield size={17}/>{t("发身份")}</button>
                : <button className={me.ready?"secondary-button wide ready-button":"primary-button"} disabled={busy||!connected} onClick={()=>void act("ready",{ready:!me.ready})}>{me.ready?<><Check size={18}/>{t("已准备 · 点击取消")}</>:<>{t("我准备好了")}<Check size={18}/></>}</button>}
              <button className="text-button subtle" onClick={()=>setConfirmLeave(true)} disabled={busy}><LogOut size={15}/>{t("离开房间")}</button>
            </div>}
            {room.phase==="ready"&&me&&<div className="lobby-ready">
              {isHost
                ? <button className="primary-button" disabled={busy||!connected} onClick={()=>void act("begin")}>{t("开始对局")}<ArrowRight size={18}/></button>
                : <p className="action-note" role="status">{t("等待房主开始对局")}</p>}
            </div>}
          </section>
          {!me&&room.phase!=="lobby"&&<aside className="room-side"><section className="action-card"><span className="eyebrow">JOIN THE TABLE</span><h2>{t("本局已经开始。")}</h2><p className="muted-copy">{t("发身份后不能中途加入。如果你本来就在这桌，点左上角皇冠，用恢复码回到原来的座位。")}</p><button className="text-button" onClick={back}><ArrowLeft size={16}/>{t("返回首页")}</button></section></aside>}
        </div>}
      </div>
      <div id="room-identity" hidden={roomPanel!=="identity"}>
        {me&&room.phase!=="lobby"?<section className="action-card identity-card"><div className="identity-heading"><span className="eyebrow"><Shield size={14}/>PRIVATE · {t("仅你可见")}</span><span className="identity-seat">{t("{n} 号",{n:me.seat})}</span></div><div className={`identity-surface ${reveal?"revealed":""}`} role="button" tabIndex={0} aria-pressed={reveal} onPointerDown={e=>{revealDrag.current=e.clientY;}} onClick={e=>{if(!identity||Math.abs(e.clientY-revealDrag.current)>12)return;setReveal(open=>!open);setSeen(true);}} onKeyDown={e=>{if(e.key!=="Enter"&&e.key!==" ")return;e.preventDefault();if(!identity)return;setReveal(open=>!open);setSeen(true);}}><span className="reveal-caption">{reveal?<EyeOff size={18}/>:<Eye size={18}/>}{reveal?t("点击隐藏"):t("点击查看")}</span>{reveal&&identity?<><span className={`side-label ${identity.side}`}>{identity.side==="good"?t("正义阵营"):t("邪恶阵营")}</span><h3>{t(ROLES[identity.role].name)}</h3><div className="identity-clues"><strong>{t("你知道的线索")}</strong>{identity.known.map(p=><div className="clue" key={p.seat}><span>{t("{n} 号",{n:p.seat})}</span><b>{p.name}</b><small>{ts(p.label)}</small></div>)}</div><p>{t(ROLES[identity.role].description)}</p><p>{ts(identity.note)}</p></>:<div className="sealed"><span className="sealed-mark"><LockKeyhole size={36} strokeWidth={1.25}/></span><strong>{t("你的身份已密封")}</strong><p>{t("秘密只有你知道。")}<br/>{t("查看前，留意身边的目光。")}</p><span className="sealed-rule"/></div>}</div>{!room.game&&<button className={me.confirmed?"secondary-button wide ready-button":"primary-button"} disabled={busy||me.confirmed||!seen||!connected} onClick={()=>{setReveal(false);void act("confirm").then(done=>{if(done)setRoomPanel("table");});}}><Check size={18}/>{me.confirmed?t("我已确认身份"):t("我记住了，确认身份")}</button>}<p className="action-note">{room.game?t("切到后台时，身份会自动隐藏。"):room.phase==="ready"?t("全员已确认，等待房主开始对局。"):t("还有 {n} 人等待确认身份",{n:room.capacity-confirmedCount})}</p>{room.phase==="ready"&&<div className="ready-notice"><Crown size={19}/><div><strong>{t("第一任队长 · {n} 号",{n:room.firstLeader??""})}</strong><p>{t("房主点击上方「开始对局」，进入第一轮。")}</p></div></div>}</section>
        :<p className="muted-copy">{t("发身份之后，在这里查看你的身份牌。")}</p>}
            {room.phase!=="finished"&&<RoomRecord room={room}/>}

      </div>
      <div hidden={roomPanel!=="notes"}><PlayerNotesPanel room={room}/></div>
      </div>
      <ActionDock key={room.game?.turnId ?? "idle"} room={room} busy={busy} connected={connected} error={error} act={act}/>
    </section>}

    <Dialog open={share} onOpenChange={setShare}><DialogContent className="share-dialog"><span className="dialog-emblem"><QrCode size={24}/></span><DialogTitle>{t("给朋友留个座位。")}</DialogTitle><DialogDescription>{t("用手机相机扫码，或输入下方房间码。")}</DialogDescription>{qr?/* eslint-disable-next-line @next/next/no-img-element -- a locally generated data: URL; image optimisation does not apply. */
<img className="qr-image" src={qr} alt={t("加入本房间的二维码")} width={240} height={240}/>:<div className="qr-loading"><LoaderCircle size={24} className="spin"/>{t("正在生成二维码…")}</div>}<div className="share-code"><small>{t("房间码")}</small>{room?.code}</div><button className="primary-button" onClick={async()=>{try{await navigator.clipboard.writeText(inviteUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError(msg("无法复制，请直接分享房间码。"));}}}>{copied?<Check size={17}/>:<Copy size={17}/ >}{copied?t("已复制邀请链接"):t("复制邀请链接")}</button><p className="action-note">{t("邀请链接含专属口令，扫码进入可看到座位昵称；只输入房间码也能入座，但不显示昵称。")}</p>{room?.inviteToken&&<a className="secondary-button big-screen-link" href={`/screen?room=${room.code}&invite=${room.inviteToken}`} target="_blank" rel="noopener"><Monitor size={17}/>{t("打开大屏模式")}</a>}{room?.inviteToken&&<p className="action-note">{t("在桌子中间的平板或电脑上打开：只显示圆桌、任务、发言顺序和表决等公开信息，不显示任何人的身份。")}</p>}</DialogContent></Dialog>
    <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}><AlertDialogContent><AlertDialogTitle>{t("让秘密各就各位？")}</AlertDialogTitle><AlertDialogDescription>{t("发身份后，本局座位与角色配置会锁定。请确认所有人都已坐在对应位置。")}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>{t("再检查一下")}</AlertDialogCancel><AlertDialogAction disabled={busy||!connected||!allReady||!isHost||room?.phase!=="lobby"} onClick={()=>void act("start")}>{t("确认发身份")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={swapSeat!==null} onOpenChange={open=>{if(!open)setSwapSeat(null);}}><AlertDialogContent><AlertDialogTitle>{t("向 {name} 申请换成 {n} 号？",{name:room?.players.find(p=>p.seat===swapSeat)?.name??"",n:swapSeat??""})}</AlertDialogTitle><AlertDialogDescription>{t("你现在是 {from} 号。对方同意后，你坐到 {to} 号，对方坐到 {from} 号，两人都要重新准备。",{from:room?.players.find(p=>p.id===room.meId)?.seat??"",to:swapSeat??""})}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>{t("再想一下")}</AlertDialogCancel><AlertDialogAction disabled={busy||!connected||swapSeat===null} onClick={()=>{const seat=swapSeat;setSwapSeat(null);if(seat)void act("swap-request",{seat});}}>{t("申请互换")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}><AlertDialogContent><AlertDialogTitle>{t("离开这个房间？")}</AlertDialogTitle><AlertDialogDescription>{t("你的座位会空出来。若你是房主，管理权会交给下一位玩家。")}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>{t("继续等朋友")}</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy||!connected||room?.phase!=="lobby"} onClick={()=>void act("leave")}>{t("离开房间")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    {account&&homeTab==="me"&&<AccountProfile account={account} onTitle={title=>setAccount({...account,title})} onAvatar={avatar=>{setAccount({...account,avatar});if(room?.meId)void act("refresh-profile");}} onLogout={()=>{void fetch("/api/account",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"logout"})});localStorage.removeItem("avalon:guest");setAccount(null);setGuest(false);setHomeTab("play");}}/>}
    {account&&<nav className="account-tabs" aria-label={t("账号")}><button type="button" className={homeTab==="me"?"active":""} onClick={()=>setHomeTab("me")}>{t("我")}</button><button type="button" className={homeTab==="play"?"active":""} onClick={()=>setHomeTab("play")}>{t("对局")}</button></nav>}
    <HelpDialog open={help} onOpenChange={setHelp}/>
    <Dialog open={menu} onOpenChange={setMenu}><DialogContent className="rules-dialog"><DialogTitle>{t("菜单")}</DialogTitle><DialogDescription>{room?t("房间码"):t("断线恢复")}</DialogDescription>{room&&<div className="share-code"><small>{t("房间码")}</small>{room.code}</div>}{room&&<button type="button" className="secondary-button" onClick={()=>{setMenu(false);setShare(true);}}><QrCode size={16}/>{t("邀请入座")}</button>}{room&&<RoomManagement key={`${room.code}:${room.round}:${room.meId}:${room.hostId}:${room.hostRevision}`} room={room} busy={busy} connected={connected} error={error} act={act} inMenu/>}<button type="button" className="secondary-button" onClick={()=>{setMenu(false);back();}}>{t("返回首页")}</button>{room&&me&&<RecoveryCodeCard room={room}/>}{room&&!me&&<SeatRecovery room={room} busy={busy} connected={connected} act={act}/>}{!room&&<p className="action-note">{t("进入房间后，可以在这里用恢复码回到原来的座位。")}</p>}<nav className="menu-links" aria-label={t("站点信息")}><Link href="/rules" onClick={()=>setMenu(false)}>{t("规则教学")}</Link><Link href="/me" onClick={()=>setMenu(false)}>{t("我的战绩")}</Link><Link href="/privacy" onClick={()=>setMenu(false)}>{t("隐私说明")}</Link></nav></DialogContent></Dialog>
  </main>;
}
