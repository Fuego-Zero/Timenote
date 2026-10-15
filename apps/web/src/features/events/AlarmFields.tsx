import { type EventInput, maxAlarms } from "@timenote/contracts";
import { Button, Flex, Form, InputNumber, Select, Space, Switch, TimePicker } from "antd";
import dayjs from "dayjs";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { fieldStatus } from "./fieldStatus.js";

const presetDays = [0, 1, 3, 7];
const customValue = -1;
const rowItemStyle: CSSProperties = { flex: "1 1 120px", minWidth: 0 };

type Alarm = EventInput["alarms"][number];

function AlarmRow({
  alarm,
  onChange,
  onRemove,
}: {
  alarm: Alarm;
  onChange: (alarm: Alarm) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("events");
  const preset = presetDays.includes(alarm.daysBefore);
  return (
    <Flex wrap gap={8}>
      <Select
        options={[
          { label: t("alarm.sameDay"), value: 0 },
          { label: t("alarm.daysBefore", { count: 1 }), value: 1 },
          { label: t("alarm.daysBefore", { count: 3 }), value: 3 },
          { label: t("alarm.daysBefore", { count: 7 }), value: 7 },
          { label: t("alarm.customDays"), value: customValue },
        ]}
        style={rowItemStyle}
        value={preset ? alarm.daysBefore : customValue}
        aria-label={t("alarm.daysAria")}
        onChange={value => onChange({ ...alarm, daysBefore: value === customValue ? 14 : value })}
      />
      {preset ? null : (
        <InputNumber
          max={365}
          min={0}
          precision={0}
          prefix={t("alarm.prefix") || undefined}
          style={rowItemStyle}
          suffix={t("alarm.suffix")}
          value={alarm.daysBefore}
          aria-label={t("alarm.customAria")}
          onChange={value => onChange({ ...alarm, daysBefore: value ?? 0 })}
        />
      )}
      <TimePicker
        allowClear={false}
        format="HH:mm"
        style={rowItemStyle}
        value={dayjs(alarm.time, "HH:mm")}
        aria-label={t("alarm.timeAria")}
        onChange={value => {
          if (value) {
            onChange({ ...alarm, time: value.format("HH:mm") });
          }
        }}
      />
      <Button style={rowItemStyle} onClick={onRemove}>
        {t("alarm.remove")}
      </Button>
    </Flex>
  );
}

/** 日历提醒：关闭时不输出 VALARM；跨天事件只围绕开始日提醒。 */
export function AlarmFields({
  draft,
  errors,
  onChange,
}: {
  draft: EventInput;
  errors: Record<string, string>;
  onChange: (draft: EventInput) => void;
}) {
  const { t } = useTranslation("events");
  const setAlarms = (alarms: Alarm[]) => onChange({ ...draft, alarms });
  const enabled = draft.alarms.length > 0;
  return (
    <Form.Item
      extra={t("alarm.extra")}
      label={t("alarm.label")}
      {...fieldStatus(errors, "alarms", "alarms.0.time", "alarms.1.time", "alarms.0.daysBefore", "alarms.1.daysBefore")}
    >
      <Space orientation="vertical" style={{ width: "100%" }}>
        <Switch
          checked={enabled}
          checkedChildren={t("alarm.on")}
          unCheckedChildren={t("alarm.off")}
          aria-label={t("alarm.switchAria")}
          onChange={checked => setAlarms(checked ? [{ daysBefore: 0, time: "09:00" }] : [])}
        />
        {draft.alarms.map((alarm, index) => (
          <AlarmRow
            // eslint-disable-next-line react-x/no-array-index-key -- 提醒最多两条、没有独立 ID，行组件不持有本地状态。
            key={index}
            alarm={alarm}
            onChange={next => setAlarms(draft.alarms.map((item, at) => (at === index ? next : item)))}
            onRemove={() => setAlarms(draft.alarms.filter((_item, at) => at !== index))}
          />
        ))}
        {enabled && draft.alarms.length < maxAlarms ? (
          <Button onClick={() => setAlarms([...draft.alarms, { daysBefore: 1, time: "09:00" }])}>
            {t("alarm.add")}
          </Button>
        ) : null}
      </Space>
    </Form.Item>
  );
}
