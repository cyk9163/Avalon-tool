import {sqliteTable,text,integer,index} from "drizzle-orm/sqlite-core";
export const rooms=sqliteTable("rooms",{
  code:text("code").primaryKey(),state:text("state").notNull(),version:integer("version").notNull().default(1),expiresAt:integer("expires_at").notNull(),ownerKey:text("owner_key").notNull(),requestId:text("request_id").notNull().unique(),
},table=>[index("idx_rooms_expiry").on(table.expiresAt),index("idx_rooms_owner").on(table.ownerKey)]);
export const rateLimits=sqliteTable("rate_limits",{
  key:text("key").primaryKey(),count:integer("count").notNull(),expiresAt:integer("expires_at").notNull(),
},table=>[index("idx_rate_limits_expiry").on(table.expiresAt)]);
