import type { EventInput } from "@timenote/contracts";
import { Alert, Button, Divider, Drawer, Grid, Space, Typography } from "antd";
import { useState } from "react";

import { ApiRequestError, errorMessage } from "../../api/client.js";
import { draftIssues } from "./eventDraft.js";
import { EventForm } from "./EventForm.js";
import { EventPreview } from "./EventPreview.js";

/** 宽屏左表单右预览；窄屏仍为上表单下预览。布局靠 CSS 断点，避免条件渲染跳动。 */
export function EventEditor({
  initial,
  editing,
  timeZone,
  onClose,
  onSave,
}: {
  initial: EventInput;
  editing: boolean;
  timeZone: string;
  onClose: () => void;
  onSave: (draft: EventInput) => Promise<void>;
}) {
  const screens = Grid.useBreakpoint();
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const localErrors = draftIssues(draft);
  // 提交前只在用户尝试保存后标红，避免打开表单就满屏错误；服务端字段错误优先展示。
  const errors = submitted ? { ...localErrors, ...serverErrors } : serverErrors;

  async function save() {
    setSubmitted(true);
    if (Object.keys(localErrors).length) {
      return;
    }

    setSaving(true);
    setSaveError(undefined);
    try {
      await onSave(draft);
    } catch (error) {
      if (error instanceof ApiRequestError && Object.keys(error.fields).length) {
        setServerErrors(error.fields);
      } else {
        setSaveError(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      destroyOnHidden
      open
      footer={
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>取消</Button>
          <Button loading={saving} type="primary" onClick={() => void save()}>
            保存
          </Button>
        </Space>
      }
      size={screens.md ? 1000 : "100%"}
      title={editing ? "编辑事件" : "新建事件"}
      onClose={onClose}
    >
      {saveError ? <Alert showIcon style={{ marginBottom: 16 }} title={saveError} type="error" /> : null}
      <div className="event-editor-layout">
        <div className="event-editor-form">
          <EventForm
            draft={draft}
            errors={errors}
            timeZone={timeZone}
            onChange={next => {
              setDraft(next);
              setServerErrors({});
            }}
          />
        </div>
        <Divider className="event-editor-divider" />
        <div className="event-editor-preview">
          <Typography.Title level={5}>未来几次（{timeZone}）</Typography.Title>
          <EventPreview draft={draft} timeZone={timeZone} />
        </div>
      </div>
    </Drawer>
  );
}
