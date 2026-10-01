import { type EventInput, eventKinds } from "@timenote/contracts";
import { Form, Input, Segmented } from "antd";

import { AlarmFields } from "./AlarmFields.js";
import { kindLabels, withKind } from "./eventDraft.js";
import { fieldStatus } from "./fieldStatus.js";
import { OriginalDateFields } from "./OriginalDateFields.js";
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
      <OriginalDateFields draft={draft} errors={errors} onChange={onChange} />
      <ScheduleFields draft={draft} errors={errors} onChange={onChange} />
      <TitleFields draft={draft} errors={errors} onChange={onChange} />
      <AlarmFields draft={draft} errors={errors} onChange={onChange} />
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
