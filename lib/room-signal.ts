// Tells the room's live hub that a change was committed. Runs after the
// response is on its way (waitUntil), and a failure only costs connected
// clients a few seconds: they fall back to polling. It never affects the
// outcome of the player's action.
import {env,waitUntil} from "cloudflare:workers";
import {log,roomRef} from "./log";

export function signalRoom(code:string,version:number){
  const hub=env.ROOM_HUB;if(!hub)return;
  waitUntil(hub.getByName(code).notify(version).catch(async(error:unknown)=>{
    log("warn","live.notify_failed",{room:await roomRef(code),reason:error instanceof Error?error.message:"unknown"});
  }));
}
