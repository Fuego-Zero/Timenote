import { type FeedToken, pageQuerySchema, type PublicUser } from "@timenote/contracts";
import { Alert, App, Button, Flex, Space, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "../../api/client.js";
import { useUrlState } from "../../ui/useUrlState.js";
import { guideTargets } from "../guide/guideTargets.js";
import { useGuide } from "../guide/useGuide.js";
import { type FeedDraft, FeedFormModal } from "./FeedFormModal.js";
import { FeedsTable } from "./FeedsTable.js";
import { useFeedTokens } from "./useFeedTokens.js";

interface FormState {
  feed?: FeedToken;
}

export function FeedsPage({ user }: { user: PublicUser }) {
  const { t } = useTranslation("feeds");
  const { message } = App.useApp();
  const guide = useGuide();
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
      void message.success(url.startsWith("webcal:") ? t("copiedWebcal") : t("copiedHttps"));
    } catch {
      void message.warning(t("copyFailed"));
    }
  }

  async function revoke(id: string) {
    await feeds.revoke(id);
    void guide.refresh();
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
      void guide.refresh();
      setQuery({ page: 1 });
    }

    setForm(undefined);
    void message.success(feed ? t("saved") : t("created"));
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Flex wrap align="center" gap="small" justify="space-between">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("pageTitle")}
        </Typography.Title>
        <Button type="primary" data-guide={guideTargets.feedsCreate} onClick={() => setForm({})}>
          {t("create")}
        </Button>
      </Flex>
      <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
        {t("intro")}{" "}
        <Button
          style={{ padding: 0, height: "auto" }}
          type="link"
          aria-haspopup="dialog"
          onClick={() => guide.openHelp("calendar")}
        >
          {t("howToAdd")}
        </Button>
      </Typography.Paragraph>
      {Boolean(feeds.error) && <Alert showIcon title={errorMessage(feeds.error)} type="error" />}
      <FeedsTable
        loading={!feeds.page && !feeds.error}
        page={feeds.page}
        query={query}
        onCopy={url => void copy(url)}
        onEdit={feed => setForm({ feed })}
        onQueryChange={setQuery}
        onRevoke={id => void run(() => revoke(id))}
        onRotate={id => void run(() => feeds.rotate(id), t("rotated"))}
      />
      {form && (
        <FeedFormModal
          key={form.feed?.id ?? "new"}
          feed={form.feed}
          user={user}
          onCancel={() => setForm(undefined)}
          onSubmit={draft => submit(form.feed, draft)}
        />
      )}
    </Space>
  );
}
