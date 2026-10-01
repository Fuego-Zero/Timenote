import { addDays, daysBetween, isoDate } from "@timenote/calendar";
import { type EventInput, maxDurationDays } from "@timenote/contracts";
import { Form, Input, InputNumber, Select } from "antd";

import { fieldStatus } from "./fieldStatus.js";

/** 持续天数与例外策略。普通事件选择「最后一天」（包含当天），周年事件直接填持续天数。 */
export function ScheduleFields({
  draft,
  errors,
  onChange,
}: {
  draft: EventInput;
  errors: Record<string, string>;
  onChange: (draft: EventInput) => void;
}) {
  const { date } = draft;
  const start = date.year === null ? undefined : isoDate(date.year, date.month, date.day);
  const showFeb29 = date.calendar === "gregorian" && date.month === 2 && date.day === 29 && draft.kind !== "event";
  const showLeap = date.calendar === "lunar" && date.leapMonth;
  const showMissingDay = date.calendar === "lunar" && date.day === 30;
  return (
    <>
      {draft.kind === "event" && start ? (
        <Form.Item extra={`共 ${draft.durationDays} 天`} label="最后一天" {...fieldStatus(errors, "durationDays")}>
          <Input
            min={start}
            type="date"
            value={addDays(start, draft.durationDays - 1)}
            aria-label="最后一天"
            onChange={event => {
              if (event.target.value) {
                // 结束早于开始时保留无效天数交给统一校验提示，而不是静默改正。
                onChange({ ...draft, durationDays: daysBetween(start, event.target.value) + 1 });
              }
            }}
          />
        </Form.Item>
      ) : (
        <Form.Item label="持续天数" {...fieldStatus(errors, "durationDays")}>
          <InputNumber
            max={maxDurationDays}
            min={1}
            precision={0}
            suffix="天"
            value={draft.durationDays}
            aria-label="持续天数"
            onChange={value => onChange({ ...draft, durationDays: value ?? 1 })}
          />
        </Form.Item>
      )}
      {showFeb29 ? (
        <Form.Item label="平年的 2 月 29 日" {...fieldStatus(errors, "rules.feb29")}>
          <Select
            options={[
              { label: "改在 2 月 28 日", value: "feb28" },
              { label: "改在 3 月 1 日", value: "mar1" },
              { label: "跳过该年", value: "skip" },
            ]}
            value={draft.rules.feb29}
            onChange={feb29 => onChange({ ...draft, rules: { ...draft.rules, feb29 } })}
          />
        </Form.Item>
      ) : null}
      {showLeap ? (
        <Form.Item label="没有对应闰月的年份" {...fieldStatus(errors, "rules.leapMonth")}>
          <Select
            options={[
              { label: "使用同名普通月", value: "regular" },
              { label: "跳过该年", value: "skip" },
            ]}
            value={draft.rules.leapMonth}
            onChange={leapMonth => onChange({ ...draft, rules: { ...draft.rules, leapMonth } })}
          />
        </Form.Item>
      ) : null}
      {showMissingDay ? (
        <Form.Item label="遇到只有 29 天的小月" {...fieldStatus(errors, "rules.missingDay")}>
          <Select
            options={[
              { label: "使用该月最后一天", value: "lastDay" },
              { label: "跳过该年", value: "skip" },
            ]}
            value={draft.rules.missingDay}
            onChange={missingDay => onChange({ ...draft, rules: { ...draft.rules, missingDay } })}
          />
        </Form.Item>
      ) : null}
    </>
  );
}
