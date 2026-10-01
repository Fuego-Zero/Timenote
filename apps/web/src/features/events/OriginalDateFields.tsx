import { formatLunarMonthDay, isoDate, LUNAR_MAX_YEAR, LUNAR_MIN_YEAR, solarToLunar } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";
import { Alert, Checkbox, Form, Input, InputNumber, Segmented, Select, Space } from "antd";
import { useState } from "react";

import { withYear } from "./eventDraft.js";
import { fieldStatus } from "./fieldStatus.js";

const monthOptions = Array.from({ length: 12 }, (_value, index) => ({ label: `${index + 1} 月`, value: index + 1 }));
const lunarMonthOptions = Array.from({ length: 12 }, (_value, index) => ({
  label: formatLunarMonthDay(index + 1, 1, false).replace("初一", ""),
  value: index + 1,
}));

const dateLabels: Record<EventInput["kind"], string> = {
  birthday: "出生日期",
  anniversary: "首次日期",
  event: "开始日期",
};

function dayOptions(lunar: boolean, month: number) {
  return Array.from({ length: 31 }, (_value, index) => index + 1)
    .filter(day => (lunar ? day <= 30 : true))
    .map(day => ({
      label: lunar ? formatLunarMonthDay(month, day, false).replace(/^.*月/, "") : `${day} 日`,
      value: day,
    }));
}

export function OriginalDateFields({
  draft,
  errors,
  onChange,
}: {
  draft: EventInput;
  errors: Record<string, string>;
  onChange: (draft: EventInput) => void;
}) {
  const { date } = draft;
  const [notice, setNotice] = useState<string>();
  const setDate = (patch: Partial<EventInput["date"]>) => onChange({ ...draft, date: { ...date, ...patch } });

  function switchCalendar(calendar: EventInput["date"]["calendar"]) {
    if (calendar === date.calendar) {
      return;
    }

    if (calendar === "lunar" && date.year !== null) {
      // 公历切换为农历依据时，换算原始日期并提示用户核对，避免把公历月日直接当成农历月日。
      try {
        const lunar = solarToLunar(isoDate(date.year, date.month, date.day));
        onChange({ ...draft, date: { calendar, ...lunar } });
        setNotice(
          `已把公历 ${isoDate(date.year, date.month, date.day)} 换算为农历 ${lunar.year} 年${formatLunarMonthDay(lunar.month, lunar.day, lunar.leapMonth)}，请核对`
        );
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "无法换算");
        onChange({ ...draft, date: { ...date, calendar, day: Math.min(date.day, 30) } });
      }

      return;
    }

    setNotice(undefined);
    onChange({ ...draft, date: { ...date, calendar, leapMonth: false } });
  }

  const yearUnknownAllowed = draft.kind !== "event";
  const lunar = date.calendar === "lunar";
  return (
    <>
      {draft.kind !== "event" ? (
        <Form.Item label="重复依据" {...fieldStatus(errors, "date.calendar")}>
          <Segmented<EventInput["date"]["calendar"]>
            options={[
              { label: "公历", value: "gregorian" },
              { label: "农历", value: "lunar" },
            ]}
            value={date.calendar}
            onChange={value => switchCalendar(value)}
          />
        </Form.Item>
      ) : null}
      {notice ? (
        <Alert
          closable
          showIcon
          style={{ marginBottom: 16 }}
          title={notice}
          type="info"
          onClose={() => setNotice(undefined)}
        />
      ) : null}
      <Form.Item
        required
        label={dateLabels[draft.kind]}
        {...fieldStatus(errors, "date.year", "date.month", "date.day", "date.leapMonth", "date")}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          {yearUnknownAllowed ? (
            <Checkbox
              checked={date.year === null}
              onChange={event =>
                onChange(withYear(draft, event.target.checked ? null : Number(new Date().getFullYear())))
              }
            >
              年份未知（只记住每年的日期，不显示岁数或周年数）
            </Checkbox>
          ) : null}
          {!lunar && date.year !== null ? (
            <Input
              type="date"
              value={isoDate(date.year, date.month, date.day)}
              aria-label="日期"
              onChange={event => {
                const [year, month, day] = event.target.value.split("-").map(Number);
                if (year && month && day) {
                  setDate({ year, month, day });
                }
              }}
            />
          ) : (
            <div className="form-row">
              {lunar && date.year !== null ? (
                <InputNumber
                  max={LUNAR_MAX_YEAR}
                  min={LUNAR_MIN_YEAR}
                  suffix="年"
                  value={date.year}
                  aria-label="农历年"
                  onChange={value => setDate({ year: value ?? date.year })}
                />
              ) : null}
              <Select
                options={lunar ? lunarMonthOptions : monthOptions}
                value={date.month}
                aria-label="月"
                onChange={month => setDate({ month })}
              />
              <Select
                options={dayOptions(lunar, date.month)}
                value={date.day}
                aria-label="日"
                onChange={day => setDate({ day })}
              />
            </div>
          )}
          {lunar ? (
            <Checkbox checked={date.leapMonth} onChange={event => setDate({ leapMonth: event.target.checked })}>
              闰月
            </Checkbox>
          ) : null}
        </Space>
      </Form.Item>
    </>
  );
}
