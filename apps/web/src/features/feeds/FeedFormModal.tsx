import type { FeedEventScope, FeedToken, PublicUser } from "@timenote/contracts";
import { Alert, Form, Input, Modal, Radio } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { EventPicker } from "./EventPicker.js";

export interface FeedDraft {
  calendarName: string;
  eventIds: string[];
  eventScope: FeedEventScope;
  name: string;
}

/** 与 ICS 默认拼装一致：显示名优先，否则用户名 +「的纪念日」。 */
function defaultCalendarName(user: PublicUser) {
  return `${user.displayName || user.username}的纪念日`;
}

/** 新建与编辑订阅共用的弹窗；保存失败（如所选事件已被删除返回 400）时在弹窗内提示并刷新选择器。 */
export function FeedFormModal({
  feed,
  onCancel,
  onSubmit,
  user,
}: {
  /** 为空时是新建。 */
  feed?: FeedToken;
  onCancel: () => void;
  onSubmit: (draft: FeedDraft) => Promise<void>;
  user: PublicUser;
}) {
  const [draft, setDraft] = useState<FeedDraft>(() =>
    feed
      ? {
          name: feed.name,
          calendarName: feed.calendarName ?? "",
          eventScope: feed.eventScope,
          eventIds: feed.eventIds,
        }
      : { name: "我的设备", calendarName: "", eventScope: "all", eventIds: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [reloadKey, setReloadKey] = useState(0);
  const title = feed ? "编辑订阅" : "创建订阅地址";
  const previewName = draft.calendarName.trim() || defaultCalendarName(user);

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit({
        name: draft.name.trim(),
        // 空串交给 API preprocess 成 null，表示未自定义 / 清空恢复默认。
        calendarName: draft.calendarName.trim(),
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
        <Form.Item extra="仅网页列表备注，不会写入日历名称。" label="设备名称">
          <Input
            maxLength={30}
            placeholder="如 iPhone、工作电脑"
            value={draft.name}
            aria-label="订阅名称"
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          />
        </Form.Item>
        <Form.Item extra={`日历中将显示：${previewName}`} label="日历显示名">
          <Input
            maxLength={40}
            placeholder={`默认：${defaultCalendarName(user)}`}
            value={draft.calendarName}
            aria-label="日历显示名"
            onChange={event => setDraft(current => ({ ...current, calendarName: event.target.value }))}
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
