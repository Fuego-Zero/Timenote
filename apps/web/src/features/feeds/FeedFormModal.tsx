import type { FeedEventScope, FeedToken } from "@timenote/contracts";
import { Alert, Form, Input, Modal, Radio } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { EventPicker } from "./EventPicker.js";

export interface FeedDraft {
  eventIds: string[];
  eventScope: FeedEventScope;
  name: string;
}

/** 新建与编辑订阅共用的弹窗；保存失败（如所选事件已被删除返回 400）时在弹窗内提示并刷新选择器。 */
export function FeedFormModal({
  feed,
  onCancel,
  onSubmit,
}: {
  /** 为空时是新建。 */
  feed?: FeedToken;
  onCancel: () => void;
  onSubmit: (draft: FeedDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FeedDraft>(() =>
    feed
      ? { name: feed.name, eventScope: feed.eventScope, eventIds: feed.eventIds }
      : { name: "我的设备", eventScope: "all", eventIds: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [reloadKey, setReloadKey] = useState(0);
  const title = feed ? "编辑订阅" : "创建订阅地址";

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit({
        name: draft.name.trim(),
        eventScope: draft.eventScope,
        eventIds: draft.eventScope === "selected" ? draft.eventIds : [],
      });
    } catch (submitError) {
      setError(submitError);
      setReloadKey(key => key + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      confirmLoading={saving}
      okButtonProps={{ disabled: !draft.name.trim() }}
      okText={feed ? "保存" : "创建"}
      title={title}
      width={720}
      onCancel={onCancel}
      onOk={() => void submit()}
    >
      <Form layout="vertical">
        {error ? <Alert showIcon style={{ marginBottom: 16 }} title={errorMessage(error)} type="error" /> : null}
        <Form.Item label="设备名称">
          <Input
            maxLength={30}
            placeholder="如 iPhone、工作电脑"
            value={draft.name}
            aria-label="订阅名称"
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          />
        </Form.Item>
        <Form.Item label="事件范围">
          <Radio.Group
            value={draft.eventScope}
            onChange={event => setDraft(current => ({ ...current, eventScope: event.target.value as FeedEventScope }))}
          >
            <Radio value="all">全部事件</Radio>
            <Radio value="selected">仅所选事件</Radio>
          </Radio.Group>
        </Form.Item>
        {draft.eventScope === "selected" ? (
          <Form.Item label="选择事件">
            <EventPicker
              reloadKey={reloadKey}
              value={draft.eventIds}
              onChange={eventIds => setDraft(current => ({ ...current, eventIds }))}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
