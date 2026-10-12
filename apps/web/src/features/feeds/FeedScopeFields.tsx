import type { FeedEventScope } from "@timenote/contracts";
import { Checkbox, Form, Radio, Typography } from "antd";

export interface ScopeDraft {
  name: string;
  eventScope: FeedEventScope;
  eventIds: string[];
}

export const emptyScopeDraft = (): ScopeDraft => ({ name: "iPhone", eventScope: "all", eventIds: [] });

export function FeedScopeFields({
  draft,
  eventOptions,
  onChange,
  layout = "form",
}: {
  draft: ScopeDraft;
  eventOptions: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<ScopeDraft>) => void;
  layout?: "form" | "plain";
}) {
  const scopeControl = (
    <Radio.Group
      value={draft.eventScope}
      onChange={event => onChange({ eventScope: event.target.value as FeedEventScope })}
    >
      <Radio value="all">全部事件</Radio>
      <Radio value="selected">仅所选事件</Radio>
    </Radio.Group>
  );

  const eventsControl =
    draft.eventScope === "selected" ? (
      <>
        <Checkbox.Group
          options={eventOptions}
          value={draft.eventIds}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            ...(layout === "plain" ? { marginTop: 8 } : {}),
          }}
          onChange={values => onChange({ eventIds: values as string[] })}
        />
        {layout === "form" && eventOptions.length === 0 ? (
          <Typography.Text type="secondary">暂无事件，创建后将生成空日历</Typography.Text>
        ) : null}
      </>
    ) : null;

  if (layout === "plain") {
    return (
      <>
        <div>
          <Typography.Text>事件范围</Typography.Text>
          <div>{scopeControl}</div>
        </div>
        {eventsControl ? (
          <div>
            <Typography.Text>选择事件</Typography.Text>
            {eventsControl}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Form.Item label="事件范围">{scopeControl}</Form.Item>
      {draft.eventScope === "selected" ? <Form.Item label="选择事件">{eventsControl}</Form.Item> : null}
    </>
  );
}
