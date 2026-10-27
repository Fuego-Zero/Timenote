import { type EventInput, isYearlyEveryYear, type TemplateVariable, titleVariables } from "@timenote/contracts";
import { Button, Form, Input, Popover, Space, theme, Typography } from "antd";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { EmojiPrefixPicker } from "./EmojiPrefixPicker.js";
import { fieldStatus } from "./fieldStatus.js";

function HelpIcon() {
  return (
    <svg fill="currentColor" height="1em" viewBox="0 0 16 16" width="1em" aria-hidden>
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1m0 1.2a5.8 5.8 0 1 1 0 11.6A5.8 5.8 0 0 1 8 2.2" />
      <path d="M6.15 6.05a1.9 1.9 0 0 1 1.82-1.3c1.05 0 1.88.7 1.88 1.7 0 .78-.4 1.2-1.15 1.7l-.28.18c-.28.2-.42.38-.42.72v.35H7.1v-.48c0-.62.28-1.02.9-1.45l.32-.22c.48-.32.68-.55.68-.9 0-.42-.38-.72-.9-.72-.5 0-.88.28-1.02.72zm1.4 4.55a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4" />
    </svg>
  );
}

const variableCodes = {
  name: "{{name}}",
  years: "{{years}}",
  count: "{{count}}",
  days: "{{days}}",
} as const satisfies Record<TemplateVariable, string>;
const meaningKeys = {
  name: "meaningName",
  years: "meaningYears",
  count: "meaningCount",
  days: "meaningDays",
} as const satisfies Record<TemplateVariable, string>;
const patternRows = [
  ["whenWeekly", "patternWeekly"],
  ["whenMonthly", "patternMonthly"],
  ["whenOtherShort", "patternOther"],
  ["whenYearly", "patternYearly"],
  ["whenYearly", "patternYearlyAge"],
  ["whenMilestone", "patternMilestone"],
  ["whenName", "patternName"],
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

function CodeChip({ children, onTint }: { children: string; onTint?: boolean }) {
  const { token } = theme.useToken();
  return (
    <code
      style={{
        background: onTint ? token.colorBgContainer : token.colorFillQuaternary,
        borderRadius: 6,
        fontFamily: token.fontFamilyCode,
        padding: "1px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </code>
  );
}

function GuidePanel({ children, tinted, title }: { children: ReactNode; tinted?: boolean; title: string }) {
  const { token } = theme.useToken();
  return (
    <section
      style={{
        background: tinted ? token.colorFillQuaternary : token.colorBgContainer,
        border: `1px solid ${tinted ? "transparent" : token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        padding: "8px 10px",
      }}
    >
      <div style={{ color: tinted ? token.colorPrimary : token.colorText, fontWeight: 600, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </section>
  );
}

/** 左右两栏、每条一行，从问号上方弹出。 */
function TemplateGuide({
  examples,
  variables,
}: {
  examples: { key: string; pattern: string; when: string }[];
  variables: { code: string; key: string; meaning: string; status: string; usable: boolean }[];
}) {
  const { t } = useTranslation("events");
  const { token } = theme.useToken();
  return (
    <div
      style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.9fr)", width: 700 }}
    >
      <GuidePanel title={t("titleFields.guideVariables")}>
        <div
          style={{
            alignItems: "center",
            columnGap: 8,
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr) auto",
            rowGap: 4,
          }}
        >
          {variables.map(variable => (
            <div key={variable.key} style={{ display: "contents" }}>
              <CodeChip>{variable.code}</CodeChip>
              <span style={{ whiteSpace: "nowrap" }}>{variable.meaning}</span>
              <span
                style={{
                  color: variable.usable ? token.colorTextSecondary : token.colorTextDescription,
                  whiteSpace: "nowrap",
                }}
              >
                {variable.status}
              </span>
            </div>
          ))}
        </div>
      </GuidePanel>
      <GuidePanel tinted title={t("titleFields.guideExamples")}>
        <div
          style={{
            alignItems: "center",
            columnGap: 8,
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr)",
            rowGap: 4,
          }}
        >
          {examples.map(example => (
            <div key={example.key} style={{ display: "contents" }}>
              <span style={{ color: token.colorTextSecondary, whiteSpace: "nowrap" }}>{example.when}</span>
              <CodeChip onTint>{example.pattern}</CodeChip>
            </div>
          ))}
        </div>
      </GuidePanel>
    </div>
  );
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
    <TemplateGuide
      examples={patternRows.map(([whenKey, patternKey]) => ({
        key: patternKey,
        pattern: t(`titleFields.${patternKey}`),
        when: t(`titleFields.${whenKey}`),
      }))}
      variables={(Object.keys(variableCodes) as TemplateVariable[]).map(variable => {
        const usable = variableUsable(draft, variable);
        return {
          code: variableCodes[variable],
          key: variable,
          meaning: t(`titleFields.${meaningKeys[variable]}`),
          status: usable ? t("titleFields.availableNow") : t("titleFields.unavailable"),
          usable,
        };
      })}
    />
  );
  return (
    <>
      <Form.Item
        required
        extra={hint}
        label={
          <Space size={4}>
            {t("titleFields.template")}
            <Popover content={guide} placement="topLeft" trigger="click">
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
        <Space style={{ width: "100%" }}>
          <Input
            maxLength={16}
            style={{ flex: 1 }}
            value={draft.titlePrefix}
            aria-label={t("titleFields.prefixAria")}
            onChange={event => onChange({ ...draft, titlePrefix: event.target.value })}
          />
          <EmojiPrefixPicker onChange={prefix => onChange({ ...draft, titlePrefix: prefix })} />
        </Space>
      </Form.Item>
    </>
  );
}
