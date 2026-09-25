import test from "node:test";
import assert from "node:assert/strict";
import {rolePool,ROLES,PRESETS,EVIL_COUNTS,roomView,mutateRoom} from "../lib/game.ts";
function sample(capacity=10,preset="full"){
  return {code:"123456",capacity,preset,phase:"identity",hostId:"p0",players:rolePool(capacity,preset).map((role,i)=>({id:`p${i}`,key:`secret-${i}`,name:`玩家${i}`,seat:i+1,ready:true,confirmed:false,role})),createdAt:0,expiresAt:Date.now()+100000,requestId:"test"};
}
test("All supported player counts and presets retain correct factions and unique special roles",()=>{
  for(let n=5;n<=10;n++)for(const [preset,spec] of Object.entries(PRESETS)){
    if(preset==="custom")continue;
    if(n<spec.minimum){assert.throws(()=>rolePool(n,preset));continue;}
    const roles=rolePool(n,preset);assert.equal(roles.length,n);assert.equal(roles.filter(r=>ROLES[r].side==="evil").length,EVIL_COUNTS[n]);
    for(const role of ["merlin","assassin","percival","morgana","mordred","oberon"])assert.ok(roles.filter(r=>r===role).length<=1);
  }
  for(const n of [0,4,11,6.5,NaN])assert.throws(()=>rolePool(n,"classic"));
});
test("Merlin sees Oberon but never Mordred or other exact roles",()=>{
  const room=sample(),me=room.players.find(p=>p.role==="merlin"),view=roomView(room,me.key,1);
  assert.ok(view.identity.known.some(p=>p.seat===room.players.find(x=>x.role==="oberon").seat));
  assert.ok(!view.identity.known.some(p=>p.seat===room.players.find(x=>x.role==="mordred").seat));
  for(const p of view.identity.known)assert.deepEqual(Object.keys(p).sort(),["label","name","seat"]);
});
test("Percival cannot distinguish candidates through role order or role fields",()=>{
  const room=sample(),me=room.players.find(p=>p.role==="percival"),before=roomView(room,me.key,1).identity;
  const a=room.players.find(p=>p.role==="merlin"),b=room.players.find(p=>p.role==="morgana");[a.role,b.role]=[b.role,a.role];
  assert.deepEqual(roomView(room,me.key,1).identity,before);
});
test("the next game starts with the seat after the last leader", () => {
  const room = sample(5, "classic");
  room.phase = "finished";
  room.round = 1;
  room.firstLeader = 5;
  room.game = { proposals: [{ leaderSeat: 2 }] };
  room.hostId = room.players[0].id;
  mutateRoom(room, room.players[0].key, "rematch", { round: 1 });
  assert.equal(room.firstLeader, undefined);
  assert.equal(room.nextFirstLeader, 3);
  for (const player of room.players) mutateRoom(room, player.key, "ready", { ready: true, round: 2 });
  mutateRoom(room, room.players[0].key, "start", { round: 2 });
  assert.equal(room.firstLeader, 3);
  assert.equal(room.nextFirstLeader, undefined);
});
test("when enabled, evil learns who Oberon is and Oberon still sees no one", () => {
  const room = sample();
  room.evilSeesOberon = true;
  const oberon = room.players.find(player => player.role === "oberon");
  assert.equal(roomView(room, oberon.key, 1).identity.known.length, 0);
  for (const player of room.players) {
    if (ROLES[player.role].side !== "evil" || player.role === "oberon") continue;
    const known = roomView(room, player.key, 1).identity.known;
    assert.ok(known.some(clue => clue.seat === oberon.seat && clue.label === "奥伯伦"));
  }
});
test("Evil sees only teammates except Oberon; loyal and Oberon have no extra information",()=>{
  const room=sample();for(const me of room.players){const identity=roomView(room,me.key,1).identity;
    if(["loyal","oberon"].includes(me.role))assert.equal(identity.known.length,0);
    if(ROLES[me.role].side==="evil"&&me.role!=="oberon"){
      assert.equal(identity.known.length,2);assert.ok(identity.known.every(k=>k.seat!==me.seat&&k.label===ROLES[room.players.find(x=>x.seat===k.seat).role].name),"evil allies see each other's exact roles");
      assert.ok(!identity.known.some(k=>k.seat===room.players.find(x=>x.role==="oberon").seat));
    }
  }
});
test("Public/host/player projections never serialize private keys or all role assignments",()=>{
  const room=sample();for(const key of ["outsider",...room.players.map(p=>p.key)]){
    const view=roomView(room,key,1);assert.ok(!JSON.stringify(view).includes("secret-"));
    assert.ok(view.players.every(p=>!("role"in p)&&!("key"in p)));
    if(key==="outsider"){assert.equal(view.identity,null);assert.equal(view.meId,null);}
  }
});
test("Host cannot start before readiness; start/confirm retries are idempotent and seating locks",()=>{
  const room=sample(5,"classic");room.phase="lobby";room.players.forEach(p=>{delete p.role;p.ready=false;});
  assert.throws(()=>mutateRoom(room,"secret-0","start",{}));assert.throws(()=>mutateRoom(room,"secret-1","start",{}));
  room.players.forEach(p=>mutateRoom(room,p.key,"ready",{ready:true}));mutateRoom(room,"secret-0","start",{});
  const identities=room.players.map(p=>p.role);mutateRoom(room,"secret-0","start",{});assert.deepEqual(room.players.map(p=>p.role),identities);
  assert.throws(()=>mutateRoom(room,"outsider","join",{seat:1,name:"new"}));assert.throws(()=>mutateRoom(room,"secret-0","seat",{seat:2}));
  room.players.forEach(p=>{mutateRoom(room,p.key,"confirm",{});mutateRoom(room,p.key,"confirm",{});});assert.equal(room.phase,"ready");
});
test("Joining cannot impersonate same nickname, steal a seat, or reuse a leaked public ID",()=>{
  const room=sample(5,"classic");room.phase="lobby";room.players=room.players.slice(0,1);
  assert.throws(()=>mutateRoom(room,"outsider","join",{seat:1,name:room.players[0].name}));
  assert.throws(()=>mutateRoom(room,room.hostId,"start",{}));
  mutateRoom(room,"outsider","join",{seat:2,name:room.players[0].name});assert.notEqual(room.players[0].id,room.players[1].id);
  mutateRoom(room,"secret-0","leave",{});assert.equal(room.hostId,room.players[0].id);
});
