import type { FeedToken } from "@timenote/contracts";
import { Input, Modal, Space, Typography } from "antd";
import { useState } from "react";

import { FeedScopeFields, type ScopeDraft } from "./FeedScopeFields.js";

export function EditFeedModal({
  feed,
  draft,
  eventOptions,
  onDraftChange,
  onCancel,
  onSave,
}: {
  feed: FeedToken | undefined;
  draft: ScopeDraft;
  eventOptions: Array<{ label: string; value: string }>;
  onDraftChange: (patch: Partial<ScopeDraft>) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      destroyOnHidden
      confirmLoading={saving}
      okText="保存"
      open={Boolean(feed)}
      title="编辑订阅"
      onCancel={onCancel}
      onOk={() => {
        if (!feed || !draft.name.trim()) {
          return;
        }

        setSaving(true);
        void onSave()
          .then(() => onCancel())
          .finally(() => setSaving(false));
      }}
    >
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <Typography.Text>设备名称</Typography.Text>
          <Input
            maxLength={30}
            value={draft.name}
            onChange={event => onDraftChange({ name: event.target.value })}
          />
        </div>
        <FeedScopeFields draft={draft} eventOptions={eventOptions} layout="plain" onChange={onDraftChange} />
      </Space>
    </Modal>
  );
}
