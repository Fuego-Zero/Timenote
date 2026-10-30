import { addDays, daysBetween, isoDate } from "@timenote/calendar";
import { type EventInput, maxDurationDays, minCycleDays } from "@timenote/contracts";
import { DatePicker, Form, InputNumber, Select } from "antd";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("events");
  const { date } = draft;
  const start = date.year === null ? undefined : isoDate(date.year, date.month, date.day);
  const showFeb29 =
    draft.recurrence !== null &&
    draft.recurrence.unit === "year" &&
    date.calendar === "gregorian" &&
    date.month === 2 &&
    date.day === 29;
  // 按天/周/月时持续天数不超过一个最短周期。
  const maxDays =
    draft.recurrence === null || draft.recurrence.unit === "year"
      ? maxDurationDays
      : Math.min(minCycleDays[draft.recurrence.unit], maxDurationDays);
  const showLeap = date.calendar === "lunar" && date.leapMonth;
  const showMissingDay = date.calendar === "lunar" && date.day === 30;
  return (
    <>
      {draft.recurrence === null && date.calendar === "gregorian" && start ? (
        <Form.Item
          extra={t("schedule.totalDays", { count: draft.durationDays })}
          label={t("schedule.lastDay")}
          {...fieldStatus(errors, "durationDays")}
        >
          <DatePicker
            allowClear={false}
            disabledDate={current => current.isBefore(dayjs(start), "day")}
            format="YYYY-MM-DD"
            value={dayjs(addDays(start, draft.durationDays - 1))}
            aria-label={t("schedule.lastDayAria")}
            onChange={value => {
              if (value) {
                // 结束日早于开始时算出无效天数，交给统一校验提示，而不是静默纠正
                onChange({ ...draft, durationDays: daysBetween(start, value.format("YYYY-MM-DD")) + 1 });
              }
            }}
          />
        </Form.Item>
      ) : (
        <Form.Item label={t("schedule.duration")} {...fieldStatus(errors, "durationDays")}>
          <InputNumber
            max={maxDays}
            min={1}
            precision={0}
            suffix={t("schedule.daySuffix")}
            value={draft.durationDays}
            aria-label={t("schedule.durationAria")}
            onChange={value => onChange({ ...draft, durationDays: value ?? 1 })}
          />
        </Form.Item>
      )}
      {showFeb29 && (
        <Form.Item extra={t("schedule.feb29Hint")} label={t("schedule.feb29")} {...fieldStatus(errors, "rules.feb29")}>
          <Select
            options={[
              { label: t("schedule.feb28"), value: "feb28" },
              { label: t("schedule.mar1"), value: "mar1" },
              { label: t("schedule.skipYear"), value: "skip" },
            ]}
            value={draft.rules.feb29}
            onChange={feb29 => onChange({ ...draft, rules: { ...draft.rules, feb29 } })}
          />
        </Form.Item>
      )}
      {showLeap && (
        <Form.Item label={t("schedule.noLeapMonth")} {...fieldStatus(errors, "rules.leapMonth")}>
          <Select
            options={[
              { label: t("schedule.useRegularMonth"), value: "regular" },
              { label: t("schedule.skipYear"), value: "skip" },
            ]}
            value={draft.rules.leapMonth}
            onChange={leapMonth => onChange({ ...draft, rules: { ...draft.rules, leapMonth } })}
          />
        </Form.Item>
      )}
      {showMissingDay && (
        <Form.Item label={t("schedule.shortMonth")} {...fieldStatus(errors, "rules.missingDay")}>
          <Select
            options={[
              { label: t("schedule.useLastDay"), value: "lastDay" },
              { label: t("schedule.skipYear"), value: "skip" },
            ]}
            value={draft.rules.missingDay}
            onChange={missingDay => onChange({ ...draft, rules: { ...draft.rules, missingDay } })}
          />
        </Form.Item>
      )}
    </>
  );
}
