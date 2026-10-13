import type { FeedToken } from "@timenote/contracts";
import { Alert, App, Space, Typography } from "antd";
import { useMemo, useState } from "react";

import { errorMessage } from "../../api/client.js";
import { useEvents } from "../events/useEvents.js";
import { CreateFeedForm } from "./CreateFeedForm.js";
import { EditFeedModal } from "./EditFeedModal.js";
import { emptyScopeDraft, type ScopeDraft } from "./FeedScopeFields.js";
import { FeedTokenList } from "./FeedTokenList.js";
import { useFeedTokens } from "./useFeedTokens.js";

/** 任务 12 由 EventPicker 替换；在此之前订阅表单取最近创建的 100 个事件作为选项。 */
const feedEventOptionsQuery = { page: 1, pageSize: 100, sort: "createdAt" } as const;

export function FeedsPage() {
  const { message } = App.useApp();
  const feeds = useFeedTokens();
  const events = useEvents(feedEventOptionsQuery);
  const [editing, setEditing] = useState<FeedToken>();
  const [editDraft, setEditDraft] = useState<ScopeDraft>(emptyScopeDraft);

  const eventOptions = useMemo(
    () => (events.page?.items ?? []).map(event => ({ label: event.name, value: event.id })),
    [events.page]
  );

  async function run(action: () => Promise<void>, success?: string) {
    try {
      await action();
      if (success) {
        void message.success(success);
      }
    } catch (error) {
      void message.error(errorMessage(error));
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      void message.success("已复制订阅地址");
    } catch {
      void message.warning("无法自动复制，请长按地址手动复制");
    }
  }

  function openEdit(feed: FeedToken) {
    setEditing(feed);
    setEditDraft({
      name: feed.name,
      eventScope: feed.eventScope,
      eventIds: feed.eventIds,
    });
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        日历订阅
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        为每台设备创建一个私密订阅地址。地址会保留在这里，可以随时复制。修改、添加或删除事件不会改地址；地址泄露时可轮换，旧地址立即失效。
      </Typography.Paragraph>
      {feeds.error ? <Alert showIcon title={errorMessage(feeds.error)} type="error" /> : null}
      {events.error ? <Alert showIcon title={errorMessage(events.error)} type="error" /> : null}
      <CreateFeedForm
        eventOptions={eventOptions}
        onCreate={draft =>
          run(
            () =>
              feeds.create({
                name: draft.name.trim(),
                eventScope: draft.eventScope,
                eventIds: draft.eventScope === "selected" ? draft.eventIds : [],
              }),
            "订阅地址已创建"
          )
        }
      />
      <FeedTokenList
        feeds={feeds.feeds ?? []}
        loading={!feeds.feeds && !feeds.error}
        onCopy={url => void copy(url)}
        onEdit={openEdit}
        onRevoke={id => void run(() => feeds.revoke(id))}
        onRotate={id => void run(() => feeds.rotate(id), "地址已轮换")}
      />
      <EditFeedModal
        draft={editDraft}
        eventOptions={eventOptions}
        feed={editing}
        onCancel={() => setEditing(undefined)}
        onDraftChange={patch => setEditDraft(current => ({ ...current, ...patch }))}
        onSave={() =>
          run(
            () =>
              feeds.update(editing!.id, {
                name: editDraft.name.trim(),
                eventScope: editDraft.eventScope,
                eventIds: editDraft.eventScope === "selected" ? editDraft.eventIds : [],
              }),
            "已保存"
          )
        }
      />
    </Space>
  );
}
