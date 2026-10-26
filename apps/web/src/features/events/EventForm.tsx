import type { EventInput } from "@timenote/contracts";
import { App, Form, Input, Segmented } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { guideTargets } from "../guide/guideTargets.js";
import { AlarmFields } from "./AlarmFields.js";
import {
  applyPreset,
  displayedPresetId,
  kindLabels,
  normalizeRecurrence,
  type PresetId,
  presetIds,
  presetViews,
  switchChanges,
} from "./eventDraft.js";
import { fieldStatus } from "./fieldStatus.js";
import { OriginalDateFields } from "./OriginalDateFields.js";
import { RecurrenceFields } from "./RecurrenceFields.js";
import { ScheduleFields } from "./ScheduleFields.js";
import { TitleFields } from "./TitleFields.js";

export function EventForm({
  draft,
  editing,
  errors,
  timeZone,
  onChange,
}: {
  draft: EventInput;
  editing: boolean;
  errors: Record<string, string>;
  timeZone: string;
  onChange: (draft: EventInput) => void;
}) {
  const { t } = useTranslation(["events", "common"]);
  const { message, modal } = App.useApp();
  const labels = kindLabels();
  const shown = displayedPresetId(draft);
  const view = presetViews[shown];
  // 新建后还停在预设刚写入的日程上时，连续切换不确认。
  const [freeSwitch, setFreeSwitch] = useState(!editing);

  const change = (next: EventInput) => {
    if (switchChanges(draft, next).length) {
      setFreeSwitch(false);
    }

    const result = normalizeRecurrence(next);
    if (result.reset) {
      void message.info(t("form.lunarYearOnlyReset"));
    }

    onChange(result.draft);
  };

  function selectKind(kind: PresetId) {
    const next = applyPreset(draft, kind, timeZone);
    const changes = switchChanges(draft, next);
    if (!freeSwitch && changes.length) {
      modal.confirm({
        title: t("form.switchTitle"),
        content: t("form.switchBody", {
          kind: labels[kind],
          changes: changes.map(changeKey => t(`form.switch.${changeKey}`)).join("；"),
        }),
        okText: t("form.switchOk"),
        cancelText: t("common:cancel"),
        onOk: () => onChange(next),
      });
      return;
    }

    onChange(next);
  }

  return (
    <Form component="div" layout="vertical">
      <div data-guide={guideTargets.eventKind}>
        <Form.Item label={t("form.kind")}>
          <Segmented
            block
            options={presetIds.map(kind => ({ label: labels[kind], value: kind }))}
            value={shown}
            onChange={kind => selectKind(kind)}
          />
        </Form.Item>
        <Form.Item
          required
          label={shown === "birthday" ? t("form.personName") : t("form.name")}
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
        <OriginalDateFields
          dateLabel={t(`originalDate.labels.${shown === "custom" ? "custom" : shown}`)}
          draft={draft}
          errors={errors}
          showsCalendar={view.showsCalendar}
          showsYearUnknown={view.showsYearUnknown && draft.recurrence !== null}
          onChange={change}
        />
      </div>
      {view.showsRecurrence ? (
        <RecurrenceFields allowOnce={view.allowOnce} draft={draft} errors={errors} onChange={change} />
      ) : null}
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
