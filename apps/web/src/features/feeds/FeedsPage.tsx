import { type FeedToken, pageQuerySchema } from "@timenote/contracts";
import { Alert, App, Button, Flex, Space, Typography } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { useUrlState } from "../../ui/useUrlState.js";
import { type FeedDraft, FeedFormModal } from "./FeedFormModal.js";
import { FeedsTable } from "./FeedsTable.js";
import { useFeedTokens } from "./useFeedTokens.js";

interface FormState {
  feed?: FeedToken;
}

export function FeedsPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useUrlState(pageQuerySchema);
  const feeds = useFeedTokens(query);
  const [form, setForm] = useState<FormState>();

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
      void message.success(url.startsWith("webcal:") ? "已复制 webcal 地址" : "已复制订阅地址");
    } catch {
      void message.warning("无法自动复制，请长按地址手动复制");
    }
  }

  async function revoke(id: string) {
    await feeds.revoke(id);
    // 撤销当前页最后一条且不在第一页时退回上一页，避免停在空页。
    if (feeds.page?.items.length === 1 && query.page > 1) {
      setQuery({ page: query.page - 1 });
    } else {
      feeds.reload();
    }
  }

  /** 失败时抛出，由弹窗内提示；成功后关闭弹窗并提示。 */
  async function submit(feed: FeedToken | undefined, draft: FeedDraft) {
    if (feed) {
      await feeds.update(feed.id, draft);
    } else {
      await feeds.create(draft);
      setQuery({ page: 1 });
    }

    setForm(undefined);
    void message.success(feed ? "已保存" : "订阅地址已创建");
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Flex wrap align="center" gap="small" justify="space-between">
        <Typography.Title level={4} style={{ margin: 0 }}>
          日历订阅
        </Typography.Title>
        <Button type="primary" onClick={() => setForm({})}>
          创建订阅地址
        </Button>
      </Flex>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        为每台设备创建一个私密订阅地址。地址等同密码，会保留在这里，可以随时复制；泄露时可轮换，旧地址立即失效。修改、添加或删除事件不会改地址。局域网或纯
        HTTP 环境下，webcal 链接可能无法被系统日历正确打开。
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        <Typography.Text strong>苹果：</Typography.Text>
        本机可点「日历打开」；分享给 iPhone / iPad 时复制 webcal 发给对方，用 Safari
        或「日历」打开以添加订阅；也可展开行后扫描页上的 webcal 二维码（主打苹果）。
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        <Typography.Text strong>Google / Android / Outlook：</Typography.Text>
        请复制 HTTPS 地址，到对应日历「通过网址添加」。不保证 App 内一点即订，也不保证扫码即可订阅。
      </Typography.Paragraph>
      {feeds.error ? <Alert showIcon title={errorMessage(feeds.error)} type="error" /> : null}
      <FeedsTable
        loading={!feeds.page && !feeds.error}
        page={feeds.page}
        query={query}
        onCopy={url => void copy(url)}
        onEdit={feed => setForm({ feed })}
        onQueryChange={setQuery}
        onRevoke={id => void run(() => revoke(id))}
        onRotate={id => void run(() => feeds.rotate(id), "地址已轮换")}
      />
      {form ? (
        <FeedFormModal
          key={form.feed?.id ?? "new"}
          feed={form.feed}
          onCancel={() => setForm(undefined)}
          onSubmit={draft => submit(form.feed, draft)}
        />
      ) : null}
    </Space>
  );
}
