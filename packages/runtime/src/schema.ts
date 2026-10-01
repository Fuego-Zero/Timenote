import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  payload: text("payload").notNull(),
});
export const sessions = sqliteTable("app_session", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  payload: text("payload").notNull(),
});
export const events = sqliteTable("event", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  payload: text("payload").notNull(),
});
export const feedTokens = sqliteTable("feed_token", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  tokenHash: text("token_hash").notNull(),
  payload: text("payload").notNull(),
});

export const tables = { users, sessions, events, feedTokens } as const;
