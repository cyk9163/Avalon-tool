import { env } from "cloudflare:workers";
import { isAvatarId } from "./avatars";
import { GameError, type Room } from "./game";
import { hash } from "./request-context";
import { isControlHost } from "./solo";
import { playFriendTable, type DemoPerson } from "./demo-table-play";

const DEMO_REQUEST = "demo-friend-table";
const NAMES = ["湖月", "阿凯", "小美", "石头", "圆圆"] as const;

function deviceId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function demoFriendTable(request: Request) {
  if (!isControlHost(new URL(request.url).hostname) || !env.DB) throw new GameError("示例桌只在测试服和本地可用。", 404);
  const existing = await env.DB.prepare("SELECT state, expires_at FROM rooms WHERE request_id = ?").bind(DEMO_REQUEST).first<{ state: string; expires_at: number }>();
  if (existing && existing.expires_at > Date.now()) {
    const room = JSON.parse(existing.state) as Room;
    if (room.phase === "team" && room.demoDevices?.length === 5) {
      return { code: room.code, invite: room.inviteToken ?? null, capacity: 5, devices: room.demoDevices, names: room.players.slice().sort((a, b) => a.seat - b.seat).map(player => player.name) };
    }
    await env.DB.prepare("DELETE FROM rooms WHERE request_id = ?").bind(DEMO_REQUEST).run();
  }
  const rows = await env.DB.prepare("SELECT id, name, avatar FROM accounts WHERE name IN ('湖月', '阿凯', '小美', '石头', '圆圆')").all<{ id: string; name: string; avatar: string | null }>();
  const byName = new Map((rows.results ?? []).map(row => [row.name, row]));
  const people: DemoPerson[] = NAMES.map(name => {
    const row = byName.get(name);
    if (!row) throw new GameError("示例桌还没准备好。", 404);
    return { id: row.id, name: row.name, avatar: isAvatarId(row.avatar) ? row.avatar : null };
  });
  const devices = NAMES.map(() => deviceId());
  const keys = await Promise.all(devices.map(device => hash(device)));
  const room = playFriendTable(people, devices, keys);
  const owner = keys[0];
  await env.DB.prepare("INSERT INTO rooms (code, state, version, expires_at, owner_key, request_id) VALUES (?, ?, 1, ?, ?, ?)").bind(room.code, JSON.stringify(room), room.expiresAt, owner, DEMO_REQUEST).run();
  return { code: room.code, invite: room.inviteToken ?? null, capacity: 5, devices, names: NAMES.slice() };
}
