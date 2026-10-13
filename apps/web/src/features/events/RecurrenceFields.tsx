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
import { Checkbox, Form, Input, InputNumber, Radio, Select, Space } from "antd";
import { useState } from "react";

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

function yearOnly(date: EventInput["date"]) {
  if (date.calendar === "lunar") {
    return "农历日期只能按年重复";
  }

  return date.year === null ? "年份未知时只能每年重复" : undefined;
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
  const { recurrence, date } = draft;
  const [custom, setCustom] = useState(() => presetOf(recurrence) === "custom");
  const yearOnlyReason = yearOnly(date);
  const preset = custom ? "custom" : presetOf(recurrence);
  const setRecurrence = (patch: Partial<Recurrence>) => onChange(withRecurrence(draft, { ...recurrence, ...patch }));
  const start = date.calendar === "gregorian" && date.year !== null ? isoDate(date.year, date.month, date.day) : "";
  const showMissingDay = date.calendar === "gregorian" && recurrence.unit === "month" && date.day >= 29;
  const presetDays = milestonePresets.filter(days => draft.milestones.includes(days));
  const customDays = draft.milestones.filter(days => !milestonePresets.includes(days));
  const setMilestones = (milestones: number[]) =>
    onChange({ ...draft, milestones: [...new Set(milestones)].sort((left, right) => left - right) });

  return (
    <>
      <Form.Item
        extra={yearOnlyReason}
        label="重复"
        {...fieldStatus(errors, "recurrence", "recurrence.unit", "recurrence.interval")}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Select<Preset>
            options={[
              { label: "每年", value: "yearly" },
              { label: "每月", value: "monthly", disabled: Boolean(yearOnlyReason) },
              { label: "每周", value: "weekly", disabled: Boolean(yearOnlyReason) },
              { label: "自定义", value: "custom", disabled: date.year === null },
            ]}
            value={preset}
            aria-label="重复"
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
                prefix="每"
                value={recurrence.interval}
                aria-label="间隔"
                onChange={value => setRecurrence({ interval: value ?? 1 })}
              />
              <Select<RecurrenceUnit>
                options={recurrenceUnits.map(unit => ({
                  label: recurrenceUnitLabels[unit],
                  value: unit,
                  disabled: unit !== "year" && Boolean(yearOnlyReason),
                }))}
                style={{ minWidth: 80 }}
                value={recurrence.unit}
                aria-label="间隔单位"
                onChange={unit => setRecurrence({ unit, interval: Math.min(recurrence.interval, maxInterval[unit]) })}
              />
            </Space.Compact>
          ) : null}
        </Space>
      </Form.Item>
      {showMissingDay ? (
        <Form.Item label="当月没有这一天" {...fieldStatus(errors, "gregorianMissingDay")}>
          <Select
            options={[
              { label: "改在当月最后一天", value: "lastDay" },
              { label: "跳过这一次", value: "skip" },
            ]}
            value={draft.gregorianMissingDay}
            aria-label="当月没有这一天"
            onChange={gregorianMissingDay => onChange({ ...draft, gregorianMissingDay })}
          />
        </Form.Item>
      ) : null}
      <Form.Item
        label="结束"
        {...fieldStatus(errors, "recurrence.end", "recurrence.end.count", "recurrence.end.until")}
      >
        <Space orientation="vertical">
          <Radio.Group
            disabled={date.year === null}
            options={[
              { label: "永不", value: "never" },
              { label: "共 N 个周期", value: "count" },
              { label: "截止到", value: "until" },
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
              prefix="共"
              suffix="个周期"
              value={recurrence.end.count}
              aria-label="周期数"
              onChange={value => setRecurrence({ end: { type: "count", count: value ?? 1 } })}
            />
          ) : null}
          {recurrence.end.type === "until" ? (
            <Input
              min={start || undefined}
              type="date"
              value={recurrence.end.until}
              aria-label="截止日期"
              onChange={event => {
                if (event.target.value) {
                  setRecurrence({ end: { type: "until", until: event.target.value } });
                }
              }}
            />
          ) : null}
        </Space>
      </Form.Item>
      <Form.Item
        extra={
          date.year === null ? "年份未知时不能设置里程碑" : `第 N 天从开始日（第 0 天）算起，最多 ${maxMilestones} 个`
        }
        label="里程碑"
        {...fieldStatus(errors, "milestones", ...draft.milestones.map((_, index) => `milestones.${index}`))}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Checkbox.Group
            disabled={date.year === null}
            options={milestonePresets.map(days => ({ label: `${days} 天`, value: days }))}
            value={presetDays}
            onChange={values => setMilestones([...values, ...customDays])}
          />
          <Select
            disabled={date.year === null}
            mode="tags"
            open={false}
            placeholder="输入其他天数后回车"
            value={customDays.map(String)}
            aria-label="自定义里程碑天数"
            onChange={(values: string[]) => setMilestones([...presetDays, ...parseDays(values)])}
          />
        </Space>
      </Form.Item>
      {draft.milestones.length ? (
        <Form.Item
          required
          extra="可用 {{name}} 与 {{days}}（第几天）"
          label="里程碑标题模板"
          {...fieldStatus(errors, "milestoneTemplate")}
        >
          <Input
            maxLength={100}
            value={draft.milestoneTemplate}
            aria-label="里程碑标题模板"
            onChange={event => onChange({ ...draft, milestoneTemplate: event.target.value })}
          />
        </Form.Item>
      ) : null}
    </>
  );
}
