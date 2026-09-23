import test from "node:test";
import assert from "node:assert/strict";
import {mutateRoom, roomView, validateCustomRoles, ROLES} from "../lib/game.ts";

const roles=["merlin","percival","goodLancelot","cleric","loyal","assassin","morgana","evilLancelot"];
function room(){
  return {code:"888888",round:1,capacity:8,preset:"custom",customRoles:roles,ladyOfLake:true,phase:"ready",hostId:"p1",firstLeader:1,
    players:roles.map((role,index)=>({id:`p${index+1}`,key:`k${index+1}`,name:`玩家${index+1}`,seat:index+1,ready:true,confirmed:true,role})),
    createdAt:1,expiresAt:Date.now()+100000,requestId:"expansion"};
}
function act(state,seat,action,input={}){mutateRoom(state,`k${seat}`,action,input);}

test("Custom boards enforce faction counts, required roles, dependencies and paired Lancelots",()=>{
  assert.deepEqual(validateCustomRoles(8,roles),roles);
  assert.throws(()=>validateCustomRoles(8,roles.map(role=>role==="assassin"?"minion":role)),/梅林与刺客/);
  assert.throws(()=>validateCustomRoles(8,roles.map(role=>role==="percival"?"loyal":role)),/莫甘娜/);
  assert.throws(()=>validateCustomRoles(8,roles.map(role=>role==="evilLancelot"?"minion":role)),/兰斯洛特/);
  assert.throws(()=>validateCustomRoles(6,["merlin","goodLancelot","loyal","loyal","assassin","evilLancelot"]),/7 人/);
});

test("Expansion identities reveal only their official private information",()=>{
  const state=room();
  const good=roomView(state,"k3",1).identity,evil=roomView(state,"k8",1).identity,cleric=roomView(state,"k4",1).identity;
  assert.deepEqual(good.known.map(item=>item.seat),[8]);
  assert.ok(evil.known.some(item=>item.seat===3&&item.label==="正义兰斯洛特"));
  assert.ok(evil.known.some(item=>item.seat===6&&item.label==="刺客"),"evil allies see each other's exact roles");
  const assassin=roomView(state,"k6",1).identity;
  assert.deepEqual(assassin.known.map(item=>[item.seat,item.label]),[[7,"莫甘娜"],[8,"邪恶兰斯洛特"]]);
  const merlin=roomView(state,"k1",1).identity;
  assert.ok(merlin.known.every(item=>item.label==="已知邪恶"),"Merlin learns only who is evil, not their roles");
  assert.deepEqual(cleric.known,[{seat:1,name:"玩家1",label:"第一任队长是正义"}]);
  assert.ok(!JSON.stringify(roomView(state,"outsider",1)).includes("正义兰斯洛特"));
});

test("Lunatic and Brute quest restrictions are enforced by the server",()=>{
  for(const [role,quest,allowed,rejected] of [["lunatic",1,"fail","success"],["brute",4,"success","fail"]]){
    const state=room();state.players[7].role=role;state.phase="quest";state.game={quest,leaderSeat:1,rejections:0,turnId:`turn-${role}`,team:[8],teamVotes:{},questVotes:{},proposals:[],quests:[],result:null,questReceipts:[]};
    assert.throws(()=>act(state,8,"quest",{turnId:state.game.turnId,card:rejected}));
    act(state,8,"quest",{turnId:state.game.turnId,card:allowed});
    assert.equal(state.game.quests[0].failCount,allowed==="fail"?1:0);
  }
});

test("Revealer becomes public after the second failed quest without exposing task-card authors",()=>{
  const state=room();state.players[7].role="revealer";state.phase="quest";state.game={quest:2,leaderSeat:1,rejections:0,turnId:"reveal-turn",team:[1,8],teamVotes:{},questVotes:{},proposals:[],quests:[{quest:1,team:[1,8],failCount:1,success:false}],result:null,questReceipts:[]};
  act(state,8,"quest",{turnId:"reveal-turn",card:"fail"});act(state,1,"quest",{turnId:"reveal-turn",card:"success"});
  assert.deepEqual(roomView(state,"k2",2).game.publicReveals,[{seat:8,role:"revealer"}]);
  const serialized=JSON.stringify(roomView(state,"k2",2));
  assert.ok(!serialized.includes("questReceipts"));assert.ok(!serialized.includes('"card":"fail"'));
});

test("Lady of the Lake passes after a private allegiance check and never leaks the result",()=>{
  const state=room();act(state,1,"begin");
  assert.equal(state.game.lake.holderSeat,2);
  state.game.quest=2;state.game.lake.pending=true;state.phase="lake";
  const turnId=state.game.turnId;act(state,2,"lake-check",{turnId,targetSeat:6});
  assert.equal(state.phase,"team");assert.equal(state.game.quest,3);assert.equal(state.game.lake.holderSeat,6);
  const after=JSON.stringify(state);act(state,2,"lake-check",{turnId,targetSeat:6});assert.equal(JSON.stringify(state),after);
  assert.deepEqual(roomView(state,"k2",2).game.lake.myChecks,[{quest:2,targetSeat:6,side:ROLES.assassin.side}]);
  assert.deepEqual(roomView(state,"k6",2).game.lake.myChecks,[]);
  assert.throws(()=>{state.phase="lake";state.game.lake.pending=true;act(state,6,"lake-check",{turnId:state.game.turnId,targetSeat:2});},/尚未使用过/);
});
