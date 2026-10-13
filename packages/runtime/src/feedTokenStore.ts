import type { PageQuery, PageResult } from "@timenote/contracts";
import { and, count, eq, type SQL, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { type StoredFeedToken, storedFeedTokenSchema } from "./entities.js";
import { containsPattern, pageOffset } from "./pageQuery.js";
import { feedTokens, type tables } from "./schema.js";

/** 与索引 feed_token_owner_created_idx 逐字一致。 */
const newestFirst = sql`json_extract(payload,'$.createdAt') DESC, id`;

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

  /** 分页列表：createdAt DESC, id；名称按字面子串匹配。 */
  listFeedTokensPage(ownerId: string, query: PageQuery): PageResult<StoredFeedToken> {
    const conditions: SQL[] = [eq(feedTokens.owner, ownerId)];
    if (query.q !== undefined) {
      conditions.push(sql`json_extract(payload,'$.name') LIKE ${containsPattern(query.q)} ESCAPE '\\'`);
    }

    const where = and(...conditions);
    const total = this.db.select({ total: count() }).from(feedTokens).where(where).get()?.total ?? 0;
    const items = this.db
      .select({ payload: feedTokens.payload })
      .from(feedTokens)
      .where(where)
      .orderBy(newestFirst)
      .limit(query.pageSize)
      .offset(pageOffset(query.page, query.pageSize))
      .all()
      .map(row => storedFeedTokenSchema.parse(JSON.parse(row.payload)));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** 事件删除后从本人订阅的 eventIds 中移除该 id，其余 id 保持原顺序；返回受影响的订阅数。 */
  removeEventIdFromFeeds(ownerId: string, eventId: string) {
    return this.db.run(
      sql`UPDATE feed_token SET payload = json_set(payload, '$.eventIds', json((SELECT json_group_array(j.value ORDER BY j.key) FROM json_each(feed_token.payload, '$.eventIds') j WHERE j.value <> ${eventId}))) WHERE owner = ${ownerId} AND json_type(payload, '$.eventIds') = 'array' AND EXISTS (SELECT 1 FROM json_each(feed_token.payload, '$.eventIds') k WHERE k.value = ${eventId})`
    ).changes;
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
