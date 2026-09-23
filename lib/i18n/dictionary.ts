// All English entries, merged from one file per area so parallel work on
// different screens never edits the same file. Keys must be unique across
// files; tests/i18n.test.mjs rejects duplicates with different translations.
import { ADMIN } from "./en/admin.ts";
import { COMMON } from "./en/common.ts";
import { DOCS } from "./en/docs.ts";
import { GAME } from "./en/game.ts";
import { HOME } from "./en/home.ts";
import { ROOM } from "./en/room.ts";
import { SERVER } from "./en/server.ts";

export const SOURCES = { COMMON, HOME, GAME, ROOM, DOCS, ADMIN, SERVER } as const;
export const EN: Record<string, string> = Object.assign({}, SERVER, COMMON, HOME, GAME, ROOM, DOCS, ADMIN);
