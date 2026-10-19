import { type FeedToken, maxQueryLength, type PageQuery, type PageResult } from "@timenote/contracts";
import { Button, Empty, Flex, Input, QRCode, Space, Table, type TableColumnsType, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { resolveLocale } from "../../i18n/index.js";
import { type RowAction, RowActions } from "../../ui/RowActions.js";
import { guideTargets } from "../guide/guideTargets.js";

const searchDebounceMs = 300;

function dateTime(ms: number, intl: string) {
  return new Date(ms).toLocaleString(intl, { hour12: false });
}

/** 有明文 webcal 时在行展开区展示二维码，避免挤进操作列。 */
function WebcalQrPanel({ webcalUrl }: { webcalUrl: string }) {
  const { t } = useTranslation("feeds");
  return (
    <Flex wrap align="flex-start" gap="middle">
      <QRCode size={120} type="svg" value={webcalUrl} />
      <Typography.Paragraph style={{ marginBottom: 0, maxWidth: 420 }} type="secondary">
        {t("qrHint")}
      </Typography.Paragraph>
    </Flex>
  );
}

export function FeedsTable({
  page,
  loading,
  query,
  onQueryChange,
  onEdit,
  onCopy,
  onRotate,
  onRevoke,
}: {
  page: PageResult<FeedToken> | undefined;
  loading: boolean;
  query: PageQuery;
  onQueryChange: (patch: Partial<PageQuery>) => void;
  onEdit: (feed: FeedToken) => void;
  onCopy: (url: string) => void;
  onRotate: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const { t, i18n } = useTranslation(["feeds", "common"]);
  const { intl } = resolveLocale(i18n.language);
  const [search, setSearch] = useState(query.q ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = search.trim() || undefined;
      if (q !== query.q) {
        onQueryChange({ q, page: 1 });
      }
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, query.q, onQueryChange]);

  function scopeLabel(feed: FeedToken) {
    if (feed.eventScope !== "selected") {
      return t("scopeAll");
    }

    const label = t("scopeSelected", { count: feed.events.length });
    const title =
      feed.events.length === 0 ? t("scopeNone") : feed.events.map(event => <div key={event.id}>{event.name}</div>);
    return (
      <Tooltip title={title}>
        <span>{label}</span>
      </Tooltip>
    );
  }

  const columns: TableColumnsType<FeedToken> = [
    {
      key: "name",
      title: t("colName"),
      width: 200,
      ellipsis: true,
      render: (_value, feed) => <Typography.Text strong>{feed.name}</Typography.Text>,
    },
    { key: "scope", title: t("colScope"), width: 100, render: (_value, feed) => scopeLabel(feed) },
    {
      key: "lastFetchedAt",
      // 表格会把标题克隆进隐藏的测量行；真实表头在 DOM 中排在前面，引导定位取到的是它。
      title: <span data-guide={guideTargets.feedLastFetched}>{t("colLastFetched")}</span>,
      width: 180,
      render: (_value, feed) => (feed.lastFetchedAt === null ? t("neverFetched") : dateTime(feed.lastFetchedAt, intl)),
    },
    {
      key: "createdAt",
      title: t("colCreated"),
      width: 180,
      render: (_value, feed) => (
        <Space orientation="vertical" size={0}>
          <span>{dateTime(feed.createdAt, intl)}</span>
          {feed.rotatedAt === feed.createdAt ? null : (
            <Typography.Text type="secondary">
              {t("rotatedAt", { time: dateTime(feed.rotatedAt, intl) })}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      key: "actions",
      title: t("common:actions"),
      // 编辑 + 复制地址 + 复制 webcal + 日历打开 + 轮换 + 撤销
      width: 450,
      render: (_value, feed, index) => {
        const { url, webcalUrl } = feed;
        const actions: RowAction[] = [{ key: "edit", label: t("common:edit"), onClick: () => onEdit(feed) }];
        if (url) {
          actions.push({ key: "copy", label: t("copyUrl"), onClick: () => onCopy(url) });
          if (webcalUrl) {
            actions.push(
              { key: "copy-webcal", label: t("copyWebcal"), onClick: () => onCopy(webcalUrl) },
              { key: "open", label: t("openCalendar"), href: webcalUrl }
            );
          }
        } else {
          // 旧订阅没有明文地址：复制置灰并说明原因；也没有可打开的 webcal 地址，故不显示 webcal / 日历打开。
          actions.push({
            key: "copy",
            label: t("copyUrl"),
            disabled: true,
            disabledReason: t("copyUnavailable"),
          });
        }

        actions.push(
          {
            key: "rotate",
            label: t("rotate"),
            confirm: {
              title: t("rotateTitle"),
              description: t("rotateDesc"),
              okText: t("rotate"),
              okDanger: false,
            },
            onClick: () => onRotate(feed.id),
          },
          {
            key: "revoke",
            label: t("revoke"),
            danger: true,
            confirm: {
              title: t("revokeTitle"),
              description: t("revokeDesc"),
              okText: t("revoke"),
              okDanger: true,
            },
            onClick: () => onRevoke(feed.id),
          }
        );
        return (
          <div data-guide={index === 0 ? guideTargets.feedActions : undefined}>
            <RowActions actions={actions} />
          </div>
        );
      },
    },
  ];

  return (
    <Space orientation="vertical" size="small" style={{ width: "100%" }}>
      <Input
        allowClear
        maxLength={maxQueryLength}
        placeholder={t("common:searchName")}
        style={{ maxWidth: 240 }}
        value={search}
        aria-label={t("searchAria")}
        onChange={event => setSearch(event.target.value)}
      />
      <Table<FeedToken>
        columns={columns}
        dataSource={page?.items ?? []}
        expandable={{
          expandedRowRender: feed => (feed.webcalUrl ? <WebcalQrPanel webcalUrl={feed.webcalUrl} /> : null),
          rowExpandable: feed => Boolean(feed.webcalUrl),
        }}
        loading={loading}
        locale={{
          emptyText:
            query.q === undefined ? (
              <Empty description={t("empty")} />
            ) : (
              <Empty description={t("emptyFiltered")}>
                <Button onClick={() => setSearch("")}>{t("clearSearch")}</Button>
              </Empty>
            ),
        }}
        // 每个账号最多 10 个订阅，不提供每页条数切换。
        pagination={{ current: query.page, pageSize: query.pageSize, total: page?.total ?? 0 }}
        rowKey="id"
        scroll={{ x: "max-content" }}
        onChange={pagination => onQueryChange({ page: pagination.current ?? 1 })}
      />
    </Space>
  );
}
