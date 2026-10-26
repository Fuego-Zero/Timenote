import { type EventInput, isYearlyEveryYear, type TemplateVariable, titleVariables } from "@timenote/contracts";
import { Button, Form, Input, Popover, Space, theme, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { fieldStatus } from "./fieldStatus.js";

const prefixChoices = ["🎂", "💞", "🎉", "⭐", "🌸"];

function HelpIcon() {
  return (
    <svg fill="currentColor" height="1em" viewBox="0 0 16 16" width="1em" aria-hidden>
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1m0 1.2a5.8 5.8 0 1 1 0 11.6A5.8 5.8 0 0 1 8 2.2" />
      <path d="M6.15 6.05a1.9 1.9 0 0 1 1.82-1.3c1.05 0 1.88.7 1.88 1.7 0 .78-.4 1.2-1.15 1.7l-.28.18c-.28.2-.42.38-.42.72v.35H7.1v-.48c0-.62.28-1.02.9-1.45l.32-.22c.48-.32.68-.55.68-.9 0-.42-.38-.72-.9-.72-.5 0-.88.28-1.02.72zm1.4 4.55a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4" />
    </svg>
  );
}

const guideVariableKeys = {
  name: "varName",
  years: "varYears",
  count: "varCount",
  days: "varDays",
} as const satisfies Record<TemplateVariable, string>;
const guideExamples = [
  "exampleWeekly",
  "exampleMonthly",
  "exampleOther",
  "exampleYearly",
  "exampleMilestone",
  "exampleName",
] as const;

function variableUsable(draft: EventInput, variable: TemplateVariable) {
  if (variable === "name") {
    return true;
  }

  if (variable === "days") {
    return draft.date.year !== null;
  }

  return titleVariables(draft).includes(variable);
}

/** 标题下只列出这次日程能用的变量和对应的一句例句。 */
function inlineHintKeys(draft: EventInput) {
  const keys = ["varName"];
  const allowed = titleVariables(draft);
  if (allowed.includes("years")) {
    keys.push("varYears", "exampleYearly");
  } else if (allowed.includes("count") && draft.recurrence && !isYearlyEveryYear(draft.recurrence)) {
    keys.push("varCount");
    const { unit, interval } = draft.recurrence;
    if (unit === "week" && interval === 1) {
      keys.push("exampleWeekly");
    } else if (unit === "month" && interval === 1) {
      keys.push("exampleMonthly");
    } else {
      keys.push("exampleOther");
    }
  }

  if (draft.date.year !== null) {
    keys.push("varDays", "exampleMilestone");
  }

  return keys;
}

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
  const { token } = theme.useToken();
  const hint = (
    <Typography.Text type="secondary">
      {inlineHintKeys(draft).map(key => (
        <span key={key}>
          {t(`titleFields.${key}`)}
          <br />
        </span>
      ))}
    </Typography.Text>
  );
  const guide = (
    <Typography.Paragraph style={{ marginBottom: 0, maxWidth: 360 }}>
      {t("titleFields.guideVariables")}
      {(Object.keys(guideVariableKeys) as TemplateVariable[]).map(variable => (
        <span key={variable}>
          <br />
          {t(`titleFields.${guideVariableKeys[variable]}`)}
          {variableUsable(draft, variable) ? "" : t("titleFields.unavailableMark")}
        </span>
      ))}
      <br />
      {t("titleFields.guideExamples")}
      {guideExamples.map(key => (
        <span key={key}>
          <br />
          {t(`titleFields.${key}`)}
        </span>
      ))}
    </Typography.Paragraph>
  );
  return (
    <>
      <Form.Item
        required
        extra={hint}
        label={
          <Space size={4}>
            {t("titleFields.template")}
            <Popover content={guide} trigger="click">
              <Button
                icon={<HelpIcon />}
                size="small"
                style={{ color: token.colorTextDescription }}
                type="text"
                aria-label={t("titleFields.allPatterns")}
              />
            </Popover>
          </Space>
        }
        {...fieldStatus(errors, "titleTemplate")}
      >
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
