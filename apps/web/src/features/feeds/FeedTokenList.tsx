import type { FeedToken } from "@timenote/contracts";
import { Button, List, Popconfirm, Space, Typography } from "antd";

function dateTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function scopeLabel(feed: FeedToken) {
  return feed.eventScope === "selected" ? `已选 ${feed.eventIds.length}` : "全部";
}

export function FeedTokenList({
  feeds,
  loading,
  onEdit,
  onCopy,
  onRotate,
  onRevoke,
}: {
  feeds: FeedToken[];
  loading: boolean;
  onEdit: (feed: FeedToken) => void;
  onCopy: (url: string) => void;
  onRotate: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <List<FeedToken>
      bordered
      dataSource={feeds}
      loading={loading}
      locale={{ emptyText: "还没有订阅地址" }}
      renderItem={feed => {
        const { url } = feed;
        return (
          <List.Item
            actions={[
              <Button key="edit" type="link" onClick={() => onEdit(feed)}>
                编辑
              </Button>,
              ...(url
                ? [
                    <Button key="copy" type="link" onClick={() => onCopy(url)}>
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
                onConfirm={() => onRotate(feed.id)}
              >
                <Button type="link">轮换</Button>
              </Popconfirm>,
              <Popconfirm
                key="revoke"
                description="撤销后该地址返回 404，设备上的订阅不再更新。"
                okButtonProps={{ danger: true }}
                title="撤销地址"
                onConfirm={() => onRevoke(feed.id)}
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
  );
}
