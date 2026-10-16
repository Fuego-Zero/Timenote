import { upcomingOccurrences } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";
import { Alert, Empty, List, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { translateDetail } from "../../i18n/translateMessage.js";
import { draftIssues } from "./eventDraft.js";
import { EventTag } from "./EventTag.js";
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
  const { t } = useTranslation("events");

  if (Object.keys(draftIssues(draft)).length) {
    return <Alert showIcon title={t("preview.incomplete")} type="warning" />;
  }

  let occurrences;
  try {
    occurrences = upcomingOccurrences(draft, now, timeZone, previewCount);
  } catch (error) {
    return (
      <Alert
        showIcon
        title={error instanceof Error ? translateDetail(error.message) : t("preview.cannotCompute")}
        type="error"
      />
    );
  }

  if (!occurrences.length) {
    return <Empty description={t("preview.none")} />;
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
                <EventTag style={{ marginInlineStart: 8 }} tone="lunar">
                  {t("preview.lunarYear", { year: occurrence.logicalYear })}
                </EventTag>
              ) : null}
            </div>
            {occurrence.alarms.map(alarm => (
              <div key={`${alarm.daysBefore}-${alarm.time}`}>
                <Typography.Text type="secondary">
                  {t("preview.alarmPrefix", { text: alarmText(alarm.at, timeZone) })}
                </Typography.Text>
              </div>
            ))}
          </div>
        </List.Item>
      )}
      size="small"
      aria-label={t("preview.aria")}
    />
  );
}
