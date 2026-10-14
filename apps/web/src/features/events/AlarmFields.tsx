import { type EventInput, maxAlarms } from "@timenote/contracts";
import { Button, Flex, Form, InputNumber, Select, Space, Switch, TimePicker } from "antd";
import dayjs from "dayjs";
import type { CSSProperties } from "react";

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
  const preset = presetDays.includes(alarm.daysBefore);
  return (
    <Flex wrap gap={8}>
      <Select
        options={[
          { label: "当天", value: 0 },
          { label: "提前 1 天", value: 1 },
          { label: "提前 3 天", value: 3 },
          { label: "提前 7 天", value: 7 },
          { label: "自定义天数", value: customValue },
        ]}
        style={rowItemStyle}
        value={preset ? alarm.daysBefore : customValue}
        aria-label="提前天数"
        onChange={value => onChange({ ...alarm, daysBefore: value === customValue ? 14 : value })}
      />
      {preset ? null : (
        <InputNumber
          max={365}
          min={0}
          precision={0}
          prefix="提前"
          style={rowItemStyle}
          suffix="天"
          value={alarm.daysBefore}
          aria-label="自定义提前天数"
          onChange={value => onChange({ ...alarm, daysBefore: value ?? 0 })}
        />
      )}
      <TimePicker
        allowClear={false}
        format="HH:mm"
        style={rowItemStyle}
        value={dayjs(alarm.time, "HH:mm")}
        aria-label="提醒时刻"
        onChange={value => {
          if (value) {
            onChange({ ...alarm, time: value.format("HH:mm") });
          }
        }}
      />
      <Button style={rowItemStyle} onClick={onRemove}>
        删除
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
  const setAlarms = (alarms: Alarm[]) => onChange({ ...draft, alarms });
  const enabled = draft.alarms.length > 0;
  return (
    <Form.Item
      extra="按账号时区的本地时刻提醒；跨天事件只在开始日前提醒"
      label="日历提醒"
      {...fieldStatus(errors, "alarms", "alarms.0.time", "alarms.1.time", "alarms.0.daysBefore", "alarms.1.daysBefore")}
    >
      <Space orientation="vertical" style={{ width: "100%" }}>
        <Switch
          checked={enabled}
          checkedChildren="开"
          unCheckedChildren="关"
          aria-label="开启提醒"
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
          <Button onClick={() => setAlarms([...draft.alarms, { daysBefore: 1, time: "09:00" }])}>再加一条提醒</Button>
        ) : null}
      </Space>
    </Form.Item>
  );
}
