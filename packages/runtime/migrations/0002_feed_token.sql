-- 订阅地址改为可重复查看：payload 允许保存 token 明文。
-- 已有行没有明文，复制后仍可按哈希校验，界面提示轮换后才能再次显示。
CREATE TABLE feed_token_next (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL CHECK (
    json_valid(payload)
    AND json_extract(payload, '$.id') IS id
    AND json_extract(payload, '$.ownerId') IS owner
    AND json_extract(payload, '$.tokenHash') IS token_hash
    AND (
      json_type(payload, '$.token') IS NULL
      OR (json_type(payload, '$.token') = 'text' AND length(json_extract(payload, '$.token')) = 43)
    )
  )
);

INSERT INTO feed_token_next (id, owner, token_hash, payload)
SELECT id, owner, token_hash, payload FROM feed_token;

DROP TABLE feed_token;
ALTER TABLE feed_token_next RENAME TO feed_token;
CREATE INDEX feed_token_owner_idx ON feed_token(owner);
