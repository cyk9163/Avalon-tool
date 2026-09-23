import assert from "node:assert/strict";
const base=process.env.AVALON_TEST_URL||"http://localhost:5173";
const hostKey=process.env.AVALON_TEST_HOST_KEY||"AVL-TEST-KEYS-2345-6789";
assert.ok(["localhost","127.0.0.1","[::1]"].includes(new URL(base).hostname),"Integration checks only run against a local server.");
class Client{
 cookie="";
 async init(){const r=await fetch(`${base}/api/room?session=1`);assert.equal(r.status,200);this.cookie=r.headers.getSetCookie()[0].split(";")[0];assert.ok(r.headers.getSetCookie()[0].includes("HttpOnly"));return this;}
 async call(body){const r=await fetch(`${base}/api/room`,{method:"POST",headers:{"Content-Type":"application/json",Origin:base,Cookie:this.cookie},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 async get(code){const r=await fetch(`${base}/api/room?code=${code}`,{headers:{Cookie:this.cookie}});assert.equal(r.headers.get("cache-control"),"no-store, private");return {status:r.status,data:await r.json()};}
}
{
 const host=await new Client().init(),customRoles=["merlin","percival","goodLancelot","loyal","assassin","morgana","evilLancelot"];
 const created=await host.call({action:"create",name:"扩展板测试",capacity:7,preset:"custom",roles:customRoles,ladyOfLake:true,requestId:crypto.randomUUID(),hostKey});
 assert.equal(created.status,200,JSON.stringify(created));assert.deepEqual(created.data.roles,customRoles);assert.equal(created.data.ladyOfLake,true);
 const invalid=await host.call({action:"create",name:"错误板子",capacity:7,preset:"custom",roles:customRoles.map(role=>role==="evilLancelot"?"minion":role),ladyOfLake:true,requestId:crypto.randomUUID(),hostKey});
 assert.equal(invalid.status,400);assert.match(invalid.data.error,/兰斯洛特/);
 console.log("PASS custom board: server accepts valid expansion roles and rejects broken dependencies");
}
for(const capacity of [5,7,10]){
 const clients=await Promise.all(Array.from({length:capacity+2},()=>new Client().init()));
 const host=clients[0],requestId=crypto.randomUUID();
 const creation={action:"create",name:"集成测试房主",capacity,preset:capacity===10?"full":"classic",requestId};
 if(capacity===5){
  for(const invalidKey of [undefined,null,{},"invalid","AVL-TAST-KEYS-2345-6789",hostKey.padEnd(129," ")]){
   const denied=await host.call({...creation,hostKey:invalidKey});assert.equal(denied.status,403,JSON.stringify(denied));
   assert.ok(!JSON.stringify(denied.data).includes(hostKey),"key errors must not echo the submitted secret");
  }
  assert.equal((await host.call({...creation,hostKey:"X".repeat(4096)})).status,413);
  const chunked=await fetch(`${base}/api/room`,{method:"POST",headers:{"Content-Type":"application/json",Origin:base,Cookie:host.cookie},duplex:"half",body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"action":"create","hostKey":"'));controller.enqueue(new TextEncoder().encode("X".repeat(2048)));controller.enqueue(new TextEncoder().encode('"}'));controller.close();}})});
  assert.equal(chunked.status,413,"oversized bodies without Content-Length must be rejected");
 }
 const created=await host.call({...creation,hostKey});assert.equal(created.status,200,JSON.stringify(created));const code=created.data.code;
 assert.ok(!Object.hasOwn(created.data,"hostKey")&&!Object.hasOwn(created.data,"HOST_KEY_HASHES")&&!JSON.stringify(created.data).includes(hostKey),"room responses must not contain creation credentials");
 const again=await host.call({...creation,hostKey});assert.equal(again.data.code,code);
 if(capacity===5){
  assert.equal((await host.call(creation)).status,403,"an existing create receipt must not bypass host-key verification");
  assert.equal((await host.call({...creation,hostKey:"AVL-TAST-KEYS-2345-6789"})).status,403);
  console.log("PASS host-key gate: missing/invalid/oversized keys denied, streamed body bounded, retries authorized, credentials never returned");
 }
 const race=await Promise.all([clients[1].call({action:"join",code,name:"抢座甲",seat:2}),clients[capacity].call({action:"join",code,name:"抢座乙",seat:2})]);assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===409).length,1);
 if(race[1].status===200)[clients[1],clients[capacity]]=[clients[capacity],clients[1]];
 const joins=await Promise.all(clients.slice(2,capacity).map((c,i)=>c.call({action:"join",code,name:`玩家${i+3}`,seat:i+3})));assert.ok(joins.every(r=>r.status===200),JSON.stringify(joins));
 assert.equal((await clients[capacity].call({action:"join",code,name:"旁观者",seat:1})).status,409);
 assert.equal((await clients[1].call({action:"start",code})).status,403);
 assert.equal((await host.call({action:"start",code})).status,409);
 const ready=await Promise.all(clients.slice(0,capacity).map(c=>c.call({action:"ready",code,ready:true})));assert.ok(ready.every(r=>r.status===200),JSON.stringify(ready));
 const starts=await Promise.all([host.call({action:"start",code}),host.call({action:"start",code})]);assert.ok(starts.every(r=>r.status===200));assert.deepEqual(starts[0].data.identity,starts[1].data.identity);
 const views=await Promise.all(clients.slice(0,capacity).map(c=>c.get(code)));assert.ok(views.every(r=>r.status===200&&r.data.identity));
 assert.equal(views.filter(r=>r.data.identity.role==="merlin").length,1);assert.equal(views.filter(r=>r.data.identity.role==="assassin").length,1);
 for(const view of views){assert.ok(view.data.players.every(p=>!Object.hasOwn(p,"role")&&!Object.hasOwn(p,"key")));for(const known of view.data.identity.known)assert.deepEqual(Object.keys(known).sort(),["label","name","seat"]);}
 const outsider=await clients[capacity+1].get(code);assert.equal(outsider.data.identity,null);assert.equal(outsider.data.meId,null);
 assert.equal((await clients[capacity+1].call({action:"confirm",code,playerId:created.data.meId})).status,403);
 assert.equal((await clients[1].call({action:"seat",code,seat:1})).status,409);
 assert.equal((await clients[capacity+1].call({action:"join",code,seat:1,name:"新玩家"})).status,403);
 const restored=await host.get(code);assert.deepEqual(restored.data.identity,starts[0].data.identity);assert.equal(restored.data.meId,created.data.meId);
 const confirms=await Promise.all(clients.slice(0,capacity).map(c=>c.call({action:"confirm",code})));assert.ok(confirms.every(r=>r.status===200));
 const done=await host.get(code);assert.equal(done.data.phase,"ready");assert.equal(done.data.players.filter(p=>p.confirmed).length,capacity);assert.ok(done.data.firstLeader>=1&&done.data.firstLeader<=capacity);
 const csrf=await fetch(`${base}/api/room`,{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://not-this-site.example",Cookie:host.cookie},body:JSON.stringify({action:"confirm",code})});assert.equal(csrf.status,403);
 console.log(`PASS ${capacity} players: concurrent seating/readiness/deal, private projections, auth, refresh, confirmation, CSRF`);
}
await import("./stage2-integration.mjs");
await import("./stage3-integration.mjs");
await import("./management-integration.mjs");
await import("./v08-integration.mjs");
console.log("All integration checks passed (test rooms expire automatically).");
