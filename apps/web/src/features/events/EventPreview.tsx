import { upcomingOccurrences } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";
import { Alert, Empty, List, Tag, Typography } from "antd";

import { draftIssues } from "./eventDraft.js";
import { alarmText, rangeText } from "./occurrenceText.js";

const previewCount = 5;

/** 保存前预览：与订阅输出调用同一个发生日计算，展示未来几次的日期、标题、持续范围和提醒时间。 */
export function EventPreview({
  draft,
  timeZone,
  now = new Date(),
}: {
  draft: EventInput;
  timeZone: string;
  now?: Date;
}) {
  if (Object.keys(draftIssues(draft)).length) {
    return <Alert showIcon title="填写完整且无误后显示预览" type="warning" />;
  }

  let occurrences;
  try {
    occurrences = upcomingOccurrences(draft, now, timeZone, previewCount);
  } catch (error) {
    return <Alert showIcon title={error instanceof Error ? error.message : "无法计算发生日"} type="error" />;
  }

  if (!occurrences.length) {
    return <Empty description="接下来没有符合规则的发生日" />;
  }

  return (
    <List
      bordered
      dataSource={occurrences}
      renderItem={occurrence => (
        <List.Item>
          <div style={{ width: "100%" }}>
            <Typography.Text strong className="event-title">
              {occurrence.title}
            </Typography.Text>
            <div>
              <Typography.Text type="secondary">{rangeText(occurrence)}</Typography.Text>
              {draft.date.calendar === "lunar" ? (
                <Tag style={{ marginInlineStart: 8 }}>农历 {occurrence.logicalYear} 年</Tag>
              ) : null}
            </div>
            {occurrence.alarms.map(alarm => (
              <div key={`${alarm.daysBefore}-${alarm.time}`}>
                <Typography.Text type="secondary">提醒：{alarmText(alarm.at, timeZone)}</Typography.Text>
              </div>
            ))}
          </div>
        </List.Item>
      )}
      size="small"
      aria-label="发生日预览"
    />
  );
}
