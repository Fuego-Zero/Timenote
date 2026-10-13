import { Button, Form, Input } from "antd";
import { useState } from "react";

import { emptyScopeDraft, FeedScopeFields, type ScopeDraft } from "./FeedScopeFields.js";

export function CreateFeedForm({
  eventOptions,
  onCreate,
}: {
  eventOptions: Array<{ label: string; value: string }>;
  onCreate: (draft: ScopeDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ScopeDraft>(emptyScopeDraft);
  const [creating, setCreating] = useState(false);

  return (
    <Form
      layout="vertical"
      onFinish={() => {
        setCreating(true);
        void onCreate(draft).finally(() => setCreating(false));
      }}
      style={{ maxWidth: 480 }}
    >
      <Form.Item label="设备名称">
        <Input
          maxLength={30}
          placeholder="如 iPhone、工作电脑"
          value={draft.name}
          aria-label="订阅名称"
          onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
        />
      </Form.Item>
      <FeedScopeFields
        draft={draft}
        eventOptions={eventOptions}
        onChange={patch => setDraft(current => ({ ...current, ...patch }))}
      />
      <Button disabled={!draft.name.trim()} htmlType="submit" loading={creating} type="primary">
        创建订阅地址
      </Button>
    </Form>
  );
}
