import { type EventInput, eventKinds } from "@timenote/contracts";
import { App, Form, Input, Segmented } from "antd";
import { useTranslation } from "react-i18next";

import { guideTargets } from "../guide/guideTargets.js";
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
  const { t } = useTranslation("events");
  const { message } = App.useApp();
  const labels = kindLabels();
  // 改成农历或年份未知时，纪念日原来的按天/周/月规则自动改回每年并提示。
  const change = (next: EventInput) => {
    const result = normalizeRecurrence(next);
    if (result.reset) {
      void message.info(t("form.lunarYearOnlyReset"));
    }

    onChange(result.draft);
  };

  return (
    <Form component="div" layout="vertical">
      <div data-guide={guideTargets.eventKind}>
        {/* 引导这一步同时介绍类型和名称，两者放在同一个定位容器里。 */}
        <Form.Item label={t("form.kind")}>
          <Segmented
            block
            options={eventKinds.map(kind => ({ label: labels[kind], value: kind }))}
            value={draft.kind}
            onChange={kind => onChange(withKind(draft, kind, timeZone))}
          />
        </Form.Item>
        <Form.Item
          required
          label={draft.kind === "birthday" ? t("form.personName") : t("form.name")}
          {...fieldStatus(errors, "name")}
        >
          <Input
            maxLength={60}
            value={draft.name}
            aria-label={t("form.nameAria")}
            onChange={event => onChange({ ...draft, name: event.target.value })}
          />
        </Form.Item>
      </div>
      <div data-guide={guideTargets.eventDate}>
        <OriginalDateFields draft={draft} errors={errors} onChange={change} />
      </div>
      {draft.kind === "anniversary" ? <RecurrenceFields draft={draft} errors={errors} onChange={change} /> : null}
      <ScheduleFields draft={draft} errors={errors} onChange={change} />
      <TitleFields draft={draft} errors={errors} onChange={change} />
      <div data-guide={guideTargets.eventAlarm}>
        <AlarmFields draft={draft} errors={errors} onChange={change} />
      </div>
      <Form.Item label={t("form.note")} {...fieldStatus(errors, "note")}>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 5 }}
          maxLength={500}
          value={draft.note}
          aria-label={t("form.noteAria")}
          onChange={event => onChange({ ...draft, note: event.target.value })}
        />
      </Form.Item>
    </Form>
  );
}
