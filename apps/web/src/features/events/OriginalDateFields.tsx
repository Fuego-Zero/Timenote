import { isoDate, LUNAR_MAX_YEAR, LUNAR_MIN_YEAR } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";
import { Alert, Checkbox, DatePicker, Flex, Form, InputNumber, Segmented, Select, Space } from "antd";
import dayjs from "dayjs";
import { type CSSProperties, useState } from "react";

import { dateLabels, dayOptions, lunarMonthOptions, monthOptions } from "./dateFieldOptions.js";
import { withYear } from "./eventDraft.js";
import { fieldStatus } from "./fieldStatus.js";
import { switchCalendarDate } from "./switchCalendarDate.js";

const rowItemStyle: CSSProperties = { flex: "1 1 120px", minWidth: 0 };

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
    const result = switchCalendarDate(date, calendar);
    if (result.notice !== undefined) {
      setNotice(result.notice);
    } else if (calendar !== date.calendar) {
      setNotice(undefined);
    }

    if (result.date !== date) {
      onChange({ ...draft, date: result.date });
    }
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
            <DatePicker
              allowClear={false}
              format="YYYY-MM-DD"
              value={dayjs(isoDate(date.year, date.month, date.day))}
              aria-label="日期"
              onChange={value => {
                if (value) {
                  setDate({ year: value.year(), month: value.month() + 1, day: value.date() });
                }
              }}
            />
          ) : (
            <Flex wrap gap={8}>
              {lunar && date.year !== null ? (
                <InputNumber
                  max={LUNAR_MAX_YEAR}
                  min={LUNAR_MIN_YEAR}
                  style={rowItemStyle}
                  suffix="年"
                  value={date.year}
                  aria-label="农历年"
                  onChange={value => setDate({ year: value ?? date.year })}
                />
              ) : null}
              <Select
                options={lunar ? lunarMonthOptions : monthOptions}
                style={rowItemStyle}
                value={date.month}
                aria-label="月"
                onChange={month => setDate({ month })}
              />
              <Select
                options={dayOptions(lunar, date.month)}
                style={rowItemStyle}
                value={date.day}
                aria-label="日"
                onChange={day => setDate({ day })}
              />
            </Flex>
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
