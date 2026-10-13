import { type FeedToken, maxQueryLength, type PageQuery, type PageResult } from "@timenote/contracts";
import { Button, Empty, Input, Popconfirm, Space, Table, type TableColumnsType, Typography } from "antd";
import { useEffect, useState } from "react";

const searchDebounceMs = 300;

function dateTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function scopeLabel(feed: FeedToken) {
  return feed.eventScope === "selected" ? `已选 ${feed.eventIds.length}` : "全部";
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
      render: (_value, feed) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{feed.name}</Typography.Text>
          {feed.url ? (
            <span className="feed-url">{feed.url}</span>
          ) : (
            <Typography.Text type="secondary">
              升级地址时没有保存明文，无法再次显示；轮换后可在当时查看。
            </Typography.Text>
          )}
        </Space>
      ),
    },
    { key: "scope", title: "范围", render: (_value, feed) => scopeLabel(feed) },
    {
      key: "lastFetchedAt",
      title: "最近拉取",
      render: (_value, feed) => (feed.lastFetchedAt === null ? "从未拉取" : dateTime(feed.lastFetchedAt)),
    },
    {
      key: "createdAt",
      title: "创建时间",
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
      render: (_value, feed) => {
        const { url } = feed;
        return (
          <Space wrap size={0}>
            <Button type="link" onClick={() => onEdit(feed)}>
              编辑
            </Button>
            {url ? (
              <>
                <Button type="link" onClick={() => onCopy(url)}>
                  复制 HTTPS 地址
                </Button>
                <Button href={feed.webcalUrl ?? undefined} type="link">
                  用日历 App 打开
                </Button>
              </>
            ) : null}
            <Popconfirm
              description="旧地址会立即失效，需要在设备上用新地址重新订阅。"
              title="轮换地址"
              onConfirm={() => onRotate(feed.id)}
            >
              <Button type="link">轮换</Button>
            </Popconfirm>
            <Popconfirm
              description="撤销后该地址返回 404，设备上的订阅不再更新。"
              okButtonProps={{ danger: true }}
              title="撤销地址"
              onConfirm={() => onRevoke(feed.id)}
            >
              <Button danger type="link">
                撤销
              </Button>
            </Popconfirm>
          </Space>
        );
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
