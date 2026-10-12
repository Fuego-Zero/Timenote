import type { FeedEventScope, FeedToken } from "@timenote/contracts";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Typography,
} from "antd";
import { useMemo, useState } from "react";

import { errorMessage } from "../../api/client.js";
import { useEvents } from "../events/useEvents.js";
import { useFeedTokens } from "./useFeedTokens.js";

function dateTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function scopeLabel(feed: FeedToken) {
  return feed.eventScope === "selected" ? `已选 ${feed.eventIds.length}` : "全部";
}

interface ScopeDraft {
  name: string;
  eventScope: FeedEventScope;
  eventIds: string[];
}

const emptyDraft = (): ScopeDraft => ({ name: "iPhone", eventScope: "all", eventIds: [] });

export function FeedsPage() {
  const { message } = App.useApp();
  const feeds = useFeedTokens();
  const events = useEvents();
  const [draft, setDraft] = useState<ScopeDraft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FeedToken>();
  const [editDraft, setEditDraft] = useState<ScopeDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const eventOptions = useMemo(
    () => (events.events ?? []).map(event => ({ label: event.name, value: event.id })),
    [events.events]
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
      <Form
        layout="vertical"
        onFinish={() => {
          setCreating(true);
          void run(
            () =>
              feeds.create({
                name: draft.name.trim(),
                eventScope: draft.eventScope,
                eventIds: draft.eventScope === "selected" ? draft.eventIds : [],
              }),
            "订阅地址已创建"
          ).finally(() => setCreating(false));
        }}
        style={{ maxWidth: 480 }}
      >
        <Form.Item label="设备名称">
          <Input
            maxLength={30}
            placeholder="设备名称，如 iPhone"
            value={draft.name}
            aria-label="订阅名称"
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          />
        </Form.Item>
        <Form.Item label="事件范围">
          <Radio.Group
            value={draft.eventScope}
            onChange={event =>
              setDraft(current => ({ ...current, eventScope: event.target.value as FeedEventScope }))
            }
          >
            <Radio value="all">全部事件</Radio>
            <Radio value="selected">仅所选事件</Radio>
          </Radio.Group>
        </Form.Item>
        {draft.eventScope === "selected" ? (
          <Form.Item label="选择事件">
            <Checkbox.Group
              options={eventOptions}
              value={draft.eventIds}
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
              onChange={values => setDraft(current => ({ ...current, eventIds: values as string[] }))}
            />
            {eventOptions.length === 0 ? (
              <Typography.Text type="secondary">暂无事件，创建后将生成空日历</Typography.Text>
            ) : null}
          </Form.Item>
        ) : null}
        <Button disabled={!draft.name.trim()} htmlType="submit" loading={creating} type="primary">
          创建订阅地址
        </Button>
      </Form>
      <List<FeedToken>
        bordered
        dataSource={feeds.feeds ?? []}
        loading={!feeds.feeds && !feeds.error}
        locale={{ emptyText: "还没有订阅地址" }}
        renderItem={feed => {
          const { url } = feed;
          return (
            <List.Item
              actions={[
                <Button key="edit" type="link" onClick={() => openEdit(feed)}>
                  编辑
                </Button>,
                ...(url
                  ? [
                      <Button key="copy" type="link" onClick={() => void copy(url)}>
                        复制
                      </Button>,
                      <Button key="webcal" href={feed.webcalUrl ?? undefined} type="link">
                        webcal
                      </Button>,
                    ]
                  : []),
                <Popconfirm
                  key="rotate"
                  description="旧地址会立即失效，需要在设备上用新地址重新订阅。"
                  title="轮换地址"
                  onConfirm={() => void run(() => feeds.rotate(feed.id), "地址已轮换")}
                >
                  <Button type="link">轮换</Button>
                </Popconfirm>,
                <Popconfirm
                  key="revoke"
                  description="撤销后该地址返回 404，设备上的订阅不再更新。"
                  okButtonProps={{ danger: true }}
                  title="撤销地址"
                  onConfirm={() => void run(() => feeds.revoke(feed.id))}
                >
                  <Button danger type="link">
                    撤销
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                description={
                  <Space orientation="vertical" size={0}>
                    {feed.url ? (
                      <span className="feed-url">{feed.url}</span>
                    ) : (
                      <span>升级地址时没有保存明文，无法再次显示；轮换后可在当时查看。</span>
                    )}
                    <Typography.Text type="secondary">
                      {`范围：${scopeLabel(feed)} · 创建于 ${dateTime(feed.createdAt)}${feed.rotatedAt !== feed.createdAt ? ` · 轮换于 ${dateTime(feed.rotatedAt)}` : ""}`}
                    </Typography.Text>
                  </Space>
                }
                title={feed.name}
              />
            </List.Item>
          );
        }}
      />
      <Modal
        destroyOnHidden
        confirmLoading={saving}
        okText="保存"
        open={Boolean(editing)}
        title="编辑订阅"
        onCancel={() => setEditing(undefined)}
        onOk={() => {
          if (!editing || !editDraft.name.trim()) {
            return;
          }

          setSaving(true);
          void run(
            () =>
              feeds.update(editing.id, {
                name: editDraft.name.trim(),
                eventScope: editDraft.eventScope,
                eventIds: editDraft.eventScope === "selected" ? editDraft.eventIds : [],
              }),
            "已保存"
          )
            .then(() => setEditing(undefined))
            .finally(() => setSaving(false));
        }}
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Typography.Text>设备名称</Typography.Text>
            <Input
              maxLength={30}
              value={editDraft.name}
              onChange={event => setEditDraft(current => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div>
            <Typography.Text>事件范围</Typography.Text>
            <div>
              <Radio.Group
                value={editDraft.eventScope}
                onChange={event =>
                  setEditDraft(current => ({
                    ...current,
                    eventScope: event.target.value as FeedEventScope,
                  }))
                }
              >
                <Radio value="all">全部事件</Radio>
                <Radio value="selected">仅所选事件</Radio>
              </Radio.Group>
            </div>
          </div>
          {editDraft.eventScope === "selected" ? (
            <div>
              <Typography.Text>选择事件</Typography.Text>
              <Checkbox.Group
                options={eventOptions}
                value={editDraft.eventIds}
                style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}
                onChange={values =>
                  setEditDraft(current => ({ ...current, eventIds: values as string[] }))
                }
              />
            </div>
          ) : null}
        </Space>
      </Modal>
    </Space>
  );
}
