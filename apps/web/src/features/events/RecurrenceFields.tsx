import { isoDate } from "@timenote/calendar";
import {
  type EventInput,
  maxInterval,
  maxMilestoneDays,
  maxMilestones,
  maxRecurrenceCount,
  type Recurrence,
  type RecurrenceUnit,
  recurrenceUnits,
} from "@timenote/contracts";
import { Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select, Space } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { withRecurrence } from "./eventDraft.js";
import { fieldStatus } from "./fieldStatus.js";
import { milestonePresets, recurrenceUnitLabels } from "./recurrenceText.js";

type Preset = "custom" | "monthly" | "weekly" | "yearly";

const presetRules: Record<Exclude<Preset, "custom">, Pick<Recurrence, "interval" | "unit">> = {
  yearly: { unit: "year", interval: 1 },
  monthly: { unit: "month", interval: 1 },
  weekly: { unit: "week", interval: 1 },
};

function presetOf(recurrence: Recurrence): Preset {
  const match = Object.entries(presetRules).find(
    ([, rule]) => rule.unit === recurrence.unit && rule.interval === recurrence.interval
  );
  return match ? presetFromKey(match[0]) : "custom";
}

function presetFromKey(key: string): Preset {
  return key === "monthly" || key === "weekly" || key === "yearly" ? key : "custom";
}

function parseDays(values: string[]) {
  return values.map(Number).filter(value => Number.isInteger(value) && value >= 1 && value <= maxMilestoneDays);
}

/** 纪念日的重复规则、结束条件与里程碑；只对纪念日显示。农历或年份未知时只能按年。 */
export function RecurrenceFields({
  draft,
  errors,
  onChange,
}: {
  draft: EventInput;
  errors: Record<string, string>;
  onChange: (draft: EventInput) => void;
}) {
  const { t } = useTranslation("events");
  const { recurrence, date } = draft;
  const [custom, setCustom] = useState(() => presetOf(recurrence) === "custom");
  let yearOnlyReason: string | undefined;
  if (date.calendar === "lunar") {
    yearOnlyReason = t("recurrence.lunarYearOnly");
  } else if (date.year === null) {
    yearOnlyReason = t("recurrence.yearUnknownOnly");
  }

  const preset = custom ? "custom" : presetOf(recurrence);
  const setRecurrence = (patch: Partial<Recurrence>) => onChange(withRecurrence(draft, { ...recurrence, ...patch }));
  const start = date.calendar === "gregorian" && date.year !== null ? isoDate(date.year, date.month, date.day) : "";
  const showMissingDay = date.calendar === "gregorian" && recurrence.unit === "month" && date.day >= 29;
  const presetDays = milestonePresets.filter(days => draft.milestones.includes(days));
  const customDays = draft.milestones.filter(days => !milestonePresets.includes(days));
  const setMilestones = (milestones: number[]) =>
    onChange({ ...draft, milestones: [...new Set(milestones)].sort((left, right) => left - right) });
  const unitLabels = recurrenceUnitLabels();

  return (
    <>
      <Form.Item
        extra={yearOnlyReason}
        label={t("recurrence.label")}
        {...fieldStatus(errors, "recurrence", "recurrence.unit", "recurrence.interval")}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Select<Preset>
            options={[
              { label: t("recurrence.yearly"), value: "yearly" },
              { label: t("recurrence.monthly"), value: "monthly", disabled: Boolean(yearOnlyReason) },
              { label: t("recurrence.weekly"), value: "weekly", disabled: Boolean(yearOnlyReason) },
              { label: t("recurrence.custom"), value: "custom", disabled: date.year === null },
            ]}
            value={preset}
            aria-label={t("recurrence.aria")}
            onChange={value => {
              setCustom(value === "custom");
              if (value !== "custom") {
                setRecurrence(presetRules[value]);
              }
            }}
          />
          {preset === "custom" ? (
            <Space.Compact>
              <InputNumber
                max={maxInterval[recurrence.unit]}
                min={1}
                precision={0}
                prefix={t("recurrence.everyPrefix")}
                value={recurrence.interval}
                aria-label={t("recurrence.intervalAria")}
                onChange={value => setRecurrence({ interval: value ?? 1 })}
              />
              <Select<RecurrenceUnit>
                options={recurrenceUnits.map(unit => ({
                  label: unitLabels[unit],
                  value: unit,
                  disabled: unit !== "year" && Boolean(yearOnlyReason),
                }))}
                style={{ minWidth: 80 }}
                value={recurrence.unit}
                aria-label={t("recurrence.unitAria")}
                onChange={unit => setRecurrence({ unit, interval: Math.min(recurrence.interval, maxInterval[unit]) })}
              />
            </Space.Compact>
          ) : null}
        </Space>
      </Form.Item>
      {showMissingDay ? (
        <Form.Item label={t("recurrence.missingDay")} {...fieldStatus(errors, "gregorianMissingDay")}>
          <Select
            options={[
              { label: t("recurrence.useMonthLast"), value: "lastDay" },
              { label: t("recurrence.skipOnce"), value: "skip" },
            ]}
            value={draft.gregorianMissingDay}
            aria-label={t("recurrence.missingDayAria")}
            onChange={gregorianMissingDay => onChange({ ...draft, gregorianMissingDay })}
          />
        </Form.Item>
      ) : null}
      <Form.Item
        label={t("recurrence.end")}
        {...fieldStatus(errors, "recurrence.end", "recurrence.end.count", "recurrence.end.until")}
      >
        <Space orientation="vertical">
          <Radio.Group
            disabled={date.year === null}
            options={[
              { label: t("recurrence.never"), value: "never" },
              { label: t("recurrence.countCycles"), value: "count" },
              { label: t("recurrence.until"), value: "until" },
            ]}
            value={recurrence.end.type}
            onChange={event => {
              const type: unknown = event.target.value;
              if (type === "count") {
                setRecurrence({ end: { type, count: 10 } });
              } else if (type === "until") {
                setRecurrence({ end: { type, until: start || isoDate(new Date().getFullYear(), 12, 31) } });
              } else {
                setRecurrence({ end: { type: "never" } });
              }
            }}
          />
          {recurrence.end.type === "count" ? (
            <InputNumber
              max={maxRecurrenceCount}
              min={1}
              precision={0}
              prefix={t("recurrence.countPrefix") || undefined}
              suffix={t("recurrence.countSuffix")}
              value={recurrence.end.count}
              aria-label={t("recurrence.countAria")}
              onChange={value => setRecurrence({ end: { type: "count", count: value ?? 1 } })}
            />
          ) : null}
          {recurrence.end.type === "until" ? (
            <DatePicker
              allowClear={false}
              disabledDate={current => start !== "" && current.isBefore(dayjs(start), "day")}
              format="YYYY-MM-DD"
              value={dayjs(recurrence.end.until)}
              aria-label={t("recurrence.untilAria")}
              onChange={value => {
                if (value) {
                  setRecurrence({ end: { type: "until", until: value.format("YYYY-MM-DD") } });
                }
              }}
            />
          ) : null}
        </Space>
      </Form.Item>
      <Form.Item
        extra={
          date.year === null
            ? t("recurrence.milestonesYearUnknown")
            : t("recurrence.milestonesExtra", { max: maxMilestones })
        }
        label={t("recurrence.milestones")}
        {...fieldStatus(errors, "milestones", ...draft.milestones.map((_, index) => `milestones.${index}`))}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Checkbox.Group
            disabled={date.year === null}
            options={milestonePresets.map(days => ({
              label: t("recurrence.milestoneDays", { count: days }),
              value: days,
            }))}
            value={presetDays}
            onChange={values => setMilestones([...values, ...customDays])}
          />
          <Select
            disabled={date.year === null}
            mode="tags"
            open={false}
            placeholder={t("recurrence.milestonePlaceholder")}
            value={customDays.map(String)}
            aria-label={t("recurrence.milestoneCustomAria")}
            onChange={(values: string[]) => setMilestones([...presetDays, ...parseDays(values)])}
          />
        </Space>
      </Form.Item>
      {draft.milestones.length ? (
        <Form.Item
          required
          extra={t("recurrence.milestoneTemplateExtra")}
          label={t("recurrence.milestoneTemplate")}
          {...fieldStatus(errors, "milestoneTemplate")}
        >
          <Input
            maxLength={100}
            value={draft.milestoneTemplate}
            aria-label={t("recurrence.milestoneTemplateAria")}
            onChange={event => onChange({ ...draft, milestoneTemplate: event.target.value })}
          />
        </Form.Item>
      ) : null}
    </>
  );
}
