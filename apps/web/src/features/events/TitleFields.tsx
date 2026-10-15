import { type EventInput, titleVariables } from "@timenote/contracts";
import { Button, Form, Input, Space } from "antd";
import { useTranslation } from "react-i18next";

import { fieldStatus } from "./fieldStatus.js";

const prefixChoices = ["🎂", "💞", "🎉", "⭐", "🌸"];

export function TitleFields({
  draft,
  errors,
  onChange,
}: {
  draft: EventInput;
  errors: Record<string, string>;
  onChange: (draft: EventInput) => void;
}) {
  const { t } = useTranslation("events");
  const variableHints: Record<string, string> = {
    name: "{{name}}",
    years: t("titleFields.yearsHint"),
    count: t("titleFields.countHint"),
    days: "",
  };
  const yearsHint = t("titleFields.available", {
    vars: titleVariables(draft)
      .map(variable => variableHints[variable])
      .join(t("titleFields.and")),
  });
  return (
    <>
      <Form.Item required extra={yearsHint} label={t("titleFields.template")} {...fieldStatus(errors, "titleTemplate")}>
        <Input
          maxLength={100}
          value={draft.titleTemplate}
          aria-label={t("titleFields.templateAria")}
          onChange={event => onChange({ ...draft, titleTemplate: event.target.value })}
        />
      </Form.Item>
      <Form.Item
        extra={t("titleFields.prefixExtra")}
        label={t("titleFields.prefix")}
        {...fieldStatus(errors, "titlePrefix")}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Input
            maxLength={16}
            value={draft.titlePrefix}
            aria-label={t("titleFields.prefixAria")}
            onChange={event => onChange({ ...draft, titlePrefix: event.target.value })}
          />
          <Space wrap size={4}>
            {prefixChoices.map(prefix => (
              <Button key={prefix} size="small" onClick={() => onChange({ ...draft, titlePrefix: prefix })}>
                {prefix}
              </Button>
            ))}
            <Button size="small" onClick={() => onChange({ ...draft, titlePrefix: "" })}>
              {t("titleFields.noPrefix")}
            </Button>
          </Space>
        </Space>
      </Form.Item>
    </>
  );
}
