import { mutateRoom, newInviteToken, newRecoveryCode, ROOM_SCHEMA_VERSION, type Room } from "./game.ts";
import type { AvatarId } from "./avatars";

const DEMO_REQUEST = "demo-friend-table";

export type DemoPerson = { id: string; name: string; avatar: AvatarId | null };

function act(room: Room, key: string, action: string, input: Record<string, unknown> = {}) {
  mutateRoom(room, key, action, { round: room.round ?? 1, ...input });
}

export function playFriendTable(people: DemoPerson[], devices: string[], keys: string[]): Room {
  const hostId = crypto.randomUUID();
  const room: Room = {
    code: String(100000 + Math.floor(Math.random() * 900000)),
    round: 1,
    capacity: 5,
    preset: "classic",
    turnSpeech: false,
    evilSeesOberon: false,
    phase: "lobby",
    hostId,
    hostRevision: 0,
    players: people.map((person, index) => ({
      id: index === 0 ? hostId : crypto.randomUUID(),
      key: keys[index],
      name: person.name,
      seat: index + 1,
      ready: false,
      confirmed: false,
      recovery: newRecoveryCode(),
      accountId: person.id,
      ...(person.avatar ? { avatar: person.avatar } : {}),
    })),
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    requestId: DEMO_REQUEST,
    schemaVersion: ROOM_SCHEMA_VERSION,
    inviteToken: newInviteToken(),
    takeovers: [],
    recoveries: [],
    demoDevices: devices,
  };
  for (const player of room.players) act(room, player.key, "ready", { ready: true });
  act(room, room.players[0].key, "start");
  for (const player of room.players) act(room, player.key, "confirm");
  act(room, room.players[0].key, "begin");
  for (const person of people) {
    const player = room.players.find(item => item.name === person.name);
    if (!player) continue;
    player.accountId = person.id;
    if (person.avatar) player.avatar = person.avatar;
  }
  return room;
}
