import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { type StoredFeedToken, storedFeedTokenSchema } from "./entities.js";
import { feedTokens, tables } from "./schema.js";

/** 订阅 token 表 DAO：只负责读写与归属过滤，不承载业务决策。 */
export class FeedTokenStore {
  constructor(private db: BetterSQLite3Database<typeof tables>) {}

  listFeedTokens(ownerId: string): StoredFeedToken[] {
    return this.db
      .select()
      .from(feedTokens)
      .where(eq(feedTokens.owner, ownerId))
      .all()
      .map(row => storedFeedTokenSchema.parse(JSON.parse(row.payload)))
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  getFeedToken(ownerId: string, id: string): StoredFeedToken | undefined {
    const row = this.db
      .select()
      .from(feedTokens)
      .where(and(eq(feedTokens.owner, ownerId), eq(feedTokens.id, id)))
      .get();
    return row ? storedFeedTokenSchema.parse(JSON.parse(row.payload)) : undefined;
  }

  getFeedTokenByHash(tokenHash: string): StoredFeedToken | undefined {
    const row = this.db.select().from(feedTokens).where(eq(feedTokens.tokenHash, tokenHash)).get();
    return row ? storedFeedTokenSchema.parse(JSON.parse(row.payload)) : undefined;
  }

  putFeedToken(feed: StoredFeedToken) {
    const payload = JSON.stringify(storedFeedTokenSchema.parse(feed));
    this.db
      .insert(feedTokens)
      .values({ id: feed.id, owner: feed.ownerId, tokenHash: feed.tokenHash, payload })
      .onConflictDoUpdate({
        target: feedTokens.id,
        set: { tokenHash: feed.tokenHash, payload },
        where: eq(feedTokens.owner, feed.ownerId),
      })
      .run();
  }

  removeFeedToken(ownerId: string, id: string) {
    return this.db
      .delete(feedTokens)
      .where(and(eq(feedTokens.owner, ownerId), eq(feedTokens.id, id)))
      .run().changes;
  }
}
