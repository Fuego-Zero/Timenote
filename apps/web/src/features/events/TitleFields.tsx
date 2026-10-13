import { type EventInput, titleVariables } from "@timenote/contracts";
import { Button, Form, Input, Space } from "antd";

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
  const variableHints = {
    name: "{{name}}",
    years: "{{years}}（岁数或周年数）",
    count: "{{count}}（第几次）",
    days: "",
  };
  const yearsHint = `可用 ${titleVariables(draft)
    .map(variable => variableHints[variable])
    .join(" 与 ")}`;
  return (
    <>
      <Form.Item required extra={yearsHint} label="标题模板" {...fieldStatus(errors, "titleTemplate")}>
        <Input
          maxLength={100}
          value={draft.titleTemplate}
          aria-label="标题模板"
          onChange={event => onChange({ ...draft, titleTemplate: event.target.value })}
        />
      </Form.Item>
      <Form.Item
        extra="可选 Emoji 或短文本，已包含时不会重复添加"
        label="标题前缀"
        {...fieldStatus(errors, "titlePrefix")}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Input
            maxLength={16}
            value={draft.titlePrefix}
            aria-label="标题前缀"
            onChange={event => onChange({ ...draft, titlePrefix: event.target.value })}
          />
          <Space wrap size={4}>
            {prefixChoices.map(prefix => (
              <Button key={prefix} size="small" onClick={() => onChange({ ...draft, titlePrefix: prefix })}>
                {prefix}
              </Button>
            ))}
            <Button size="small" onClick={() => onChange({ ...draft, titlePrefix: "" })}>
              不加
            </Button>
          </Space>
        </Space>
      </Form.Item>
    </>
  );
}
