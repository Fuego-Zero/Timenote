import { type EventInput, eventKinds } from "@timenote/contracts";
import { App, Form, Input, Segmented } from "antd";

import { AlarmFields } from "./AlarmFields.js";
import { kindLabels, normalizeRecurrence, withKind } from "./eventDraft.js";
import { fieldStatus } from "./fieldStatus.js";
import { OriginalDateFields } from "./OriginalDateFields.js";
import { RecurrenceFields } from "./RecurrenceFields.js";
import { ScheduleFields } from "./ScheduleFields.js";
import { TitleFields } from "./TitleFields.js";

export function EventForm({
  draft,
  errors,
  timeZone,
  onChange,
}: {
  draft: EventInput;
  errors: Record<string, string>;
  timeZone: string;
  onChange: (draft: EventInput) => void;
}) {
  const { message } = App.useApp();
  // 改成农历或年份未知时，纪念日原来的按天/周/月规则自动改回每年并提示。
  const change = (next: EventInput) => {
    const result = normalizeRecurrence(next);
    if (result.reset) {
      void message.info("农历或年份未知时只能按年重复，已改回每年");
    }

    onChange(result.draft);
  };

  return (
    <Form component="div" layout="vertical">
      <Form.Item label="类型">
        <Segmented
          block
          options={eventKinds.map(kind => ({ label: kindLabels[kind], value: kind }))}
          value={draft.kind}
          onChange={kind => onChange(withKind(draft, kind, timeZone))}
        />
      </Form.Item>
      <Form.Item required label={draft.kind === "birthday" ? "姓名" : "名称"} {...fieldStatus(errors, "name")}>
        <Input
          maxLength={60}
          value={draft.name}
          aria-label="名称"
          onChange={event => onChange({ ...draft, name: event.target.value })}
        />
      </Form.Item>
      <OriginalDateFields draft={draft} errors={errors} onChange={change} />
      {draft.kind === "anniversary" ? <RecurrenceFields draft={draft} errors={errors} onChange={change} /> : null}
      <ScheduleFields draft={draft} errors={errors} onChange={change} />
      <TitleFields draft={draft} errors={errors} onChange={change} />
      <AlarmFields draft={draft} errors={errors} onChange={change} />
      <Form.Item label="备注" {...fieldStatus(errors, "note")}>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 5 }}
          maxLength={500}
          value={draft.note}
          aria-label="备注"
          onChange={event => onChange({ ...draft, note: event.target.value })}
        />
      </Form.Item>
    </Form>
  );
}
