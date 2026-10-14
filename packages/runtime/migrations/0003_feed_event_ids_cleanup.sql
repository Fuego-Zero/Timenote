-- 清理订阅 eventIds 中已删除或不属于订阅归属账号的事件 id；剩余 id 按原顺序保留（SQLite ≥ 3.44 聚合内 ORDER BY）。
-- 原为 [] 或全部悬空的订阅结果为 []；没有 eventIds 数组（读作 all）的订阅不动。
UPDATE feed_token SET payload = json_set(payload, '$.eventIds', json((SELECT json_group_array(j.value ORDER BY j.key) FROM json_each(feed_token.payload, '$.eventIds') j WHERE EXISTS (SELECT 1 FROM event e WHERE e.id = j.value AND e.owner = feed_token.owner)))) WHERE json_type(payload, '$.eventIds') = 'array';
