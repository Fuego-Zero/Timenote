-- 历史普通事件把「每 1 年」存着，展开时却只输出一次。改成 recurrence 为 null，表示只发生一次。
-- 只改 payload，不改 revision、updatedAt，订阅内容与 ETag 保持不变。
UPDATE event
SET payload = json_set(payload, '$.recurrence', json('null'))
WHERE json_extract(payload, '$.kind') = 'event'
  AND json_type(payload, '$.recurrence') != 'null';
