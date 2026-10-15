import { type FeedToken, maxQueryLength, type PageQuery, type PageResult } from "@timenote/contracts";
import { Button, Empty, Flex, Input, QRCode, Space, Table, type TableColumnsType, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";

import { type RowAction, RowActions } from "../../ui/RowActions.js";

const searchDebounceMs = 300;

function dateTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function scopeLabel(feed: FeedToken) {
  if (feed.eventScope !== "selected") {
    return "全部";
  }

  const label = `已选 ${feed.events.length}`;
  const title =
    feed.events.length === 0 ? "没有选中事件" : feed.events.map(event => <div key={event.id}>{event.name}</div>);
  return (
    <Tooltip title={title}>
      <span>{label}</span>
    </Tooltip>
  );
}

/** 有明文 webcal 时在行展开区展示二维码，避免挤进操作列。 */
function WebcalQrPanel({ webcalUrl }: { webcalUrl: string }) {
  return (
    <Flex wrap align="flex-start" gap="middle">
      <QRCode size={120} type="svg" value={webcalUrl} />
      <Typography.Paragraph style={{ marginBottom: 0, maxWidth: 420 }} type="secondary">
        扫码得到与「复制 webcal」相同的地址，由系统日历处理（适用于 Apple 日历）。Google / Android
        不保证扫码即订，请改用「复制地址」取得 HTTPS 后手动添加。
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

  const columns: TableColumnsType<FeedToken> = [
    {
      key: "name",
      title: "名称",
      width: 200,
      ellipsis: true,
      render: (_value, feed) => <Typography.Text strong>{feed.name}</Typography.Text>,
    },
    { key: "scope", title: "范围", width: 100, render: (_value, feed) => scopeLabel(feed) },
    {
      key: "lastFetchedAt",
      title: "最近拉取",
      width: 180,
      render: (_value, feed) => (feed.lastFetchedAt === null ? "从未拉取" : dateTime(feed.lastFetchedAt)),
    },
    {
      key: "createdAt",
      title: "创建时间",
      width: 180,
      render: (_value, feed) => (
        <Space orientation="vertical" size={0}>
          <span>{dateTime(feed.createdAt)}</span>
          {feed.rotatedAt === feed.createdAt ? null : (
            <Typography.Text type="secondary">{`轮换于 ${dateTime(feed.rotatedAt)}`}</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      key: "actions",
      title: "操作",
      // 编辑 + 复制地址 + 复制 webcal + 日历打开 + 轮换 + 撤销
      width: 450,
      render: (_value, feed) => {
        const { url, webcalUrl } = feed;
        const actions: RowAction[] = [{ key: "edit", label: "编辑", onClick: () => onEdit(feed) }];
        if (url) {
          actions.push({ key: "copy", label: "复制地址", onClick: () => onCopy(url) });
          if (webcalUrl) {
            actions.push(
              { key: "copy-webcal", label: "复制 webcal", onClick: () => onCopy(webcalUrl) },
              { key: "open", label: "日历打开", href: webcalUrl }
            );
          }
        } else {
          // 旧订阅没有明文地址：复制置灰并说明原因；也没有可打开的 webcal 地址，故不显示 webcal / 日历打开。
          actions.push({
            key: "copy",
            label: "复制地址",
            disabled: true,
            disabledReason: "升级地址时没有保存明文，无法再次显示；轮换后可在当时查看。",
          });
        }

        actions.push(
          {
            key: "rotate",
            label: "轮换",
            confirm: {
              title: "轮换地址",
              description: "旧地址会立即失效，需要在设备上用新地址重新订阅。",
              okText: "轮换",
              okDanger: false,
            },
            onClick: () => onRotate(feed.id),
          },
          {
            key: "revoke",
            label: "撤销",
            danger: true,
            confirm: {
              title: "撤销地址",
              description: "撤销后该地址返回 404，设备上的订阅不再更新。",
              okText: "撤销",
              okDanger: true,
            },
            onClick: () => onRevoke(feed.id),
          }
        );
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <Space orientation="vertical" size="small" style={{ width: "100%" }}>
      <Input
        allowClear
        maxLength={maxQueryLength}
        placeholder="搜索名称"
        style={{ maxWidth: 240 }}
        value={search}
        aria-label="搜索订阅"
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
              <Empty description="还没有订阅地址" />
            ) : (
              <Empty description="没有匹配的订阅">
                <Button onClick={() => setSearch("")}>清除搜索</Button>
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
