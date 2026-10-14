-- 分页列表按 createdAt DESC, id 排序；查询的 ORDER BY 表达式必须与索引逐字一致。
CREATE INDEX IF NOT EXISTS event_owner_created_idx ON event(owner, json_extract(payload,'$.createdAt') DESC, id);
CREATE INDEX IF NOT EXISTS feed_token_owner_created_idx ON feed_token(owner, json_extract(payload,'$.createdAt') DESC, id);
CREATE INDEX IF NOT EXISTS user_created_idx ON "user"(json_extract(payload,'$.createdAt') DESC, id);
