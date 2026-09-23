import {sqliteTable,text,integer,index} from "drizzle-orm/sqlite-core";
export const rooms=sqliteTable("rooms",{
  code:text("code").primaryKey(),state:text("state").notNull(),version:integer("version").notNull().default(1),expiresAt:integer("expires_at").notNull(),ownerKey:text("owner_key").notNull(),requestId:text("request_id").notNull().unique(),
},table=>[index("idx_rooms_expiry").on(table.expiresAt),index("idx_rooms_owner").on(table.ownerKey)]);
export const rateLimits=sqliteTable("rate_limits",{
  key:text("key").primaryKey(),count:integer("count").notNull(),expiresAt:integer("expires_at").notNull(),
},table=>[index("idx_rate_limits_expiry").on(table.expiresAt)]);
export const pushSubscriptions=sqliteTable("push_subscriptions",{
  id:text("id").primaryKey(),roomHash:text("room_hash").notNull(),playerId:text("player_id").notNull(),endpoint:text("endpoint").notNull(),p256dh:text("p256dh").notNull(),auth:text("auth").notNull(),lang:text("lang").notNull(),createdAt:integer("created_at").notNull(),expiresAt:integer("expires_at").notNull(),
},table=>[index("idx_push_expiry").on(table.expiresAt),index("idx_push_room").on(table.roomHash)]);
