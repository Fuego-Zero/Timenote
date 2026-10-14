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
      void message.success("已复制订阅地址");
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
      <Typography.Paragraph type="secondary">
        为每台设备创建一个私密订阅地址。地址会保留在这里，可以随时复制。修改、添加或删除事件不会改地址；地址泄露时可轮换，旧地址立即失效。
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
