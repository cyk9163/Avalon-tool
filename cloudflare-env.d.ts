declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    HOST_KEY_HASHES?: string;
    ADMIN_KEY_HASHES?: string;
    ROOM_HUB?: DurableObjectNamespace<import("./lib/room-hub").RoomHub>;
    VAPID_PRIVATE_KEY?: string;
  }
}
