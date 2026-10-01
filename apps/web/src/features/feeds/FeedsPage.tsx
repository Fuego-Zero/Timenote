import type { FeedToken, IssuedFeed } from "@timenote/contracts";
import { Alert, App, Button, Form, Input, List, Popconfirm, Space, Typography } from "antd";
import { useState } from "react";

import { errorMessage } from "../../api/client.js";
import { IssuedFeedModal } from "./IssuedFeedModal.js";
import { useFeedTokens } from "./useFeedTokens.js";

function dateTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

export function FeedsPage() {
  const { message } = App.useApp();
  const feeds = useFeedTokens();
  const [issued, setIssued] = useState<IssuedFeed>();
  const [name, setName] = useState("iPhone");
  const [creating, setCreating] = useState(false);

  async function run(action: () => Promise<IssuedFeed | void>) {
    try {
      const result = await action();
      if (result) {
        setIssued(result);
      }
    } catch (error) {
      void message.error(errorMessage(error));
    }
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        日历订阅
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        为每台设备创建一个私密订阅地址。修改、添加或删除事件不会改变地址；地址泄露时可以轮换或撤销，旧地址立即失效。
      </Typography.Paragraph>
      {feeds.error ? <Alert showIcon title={errorMessage(feeds.error)} type="error" /> : null}
      <Form
        layout="inline"
        onFinish={() => {
          setCreating(true);
          void run(() => feeds.create(name.trim())).finally(() => setCreating(false));
        }}
      >
        <Form.Item>
          <Input
            maxLength={30}
            placeholder="设备名称，如 iPhone"
            value={name}
            aria-label="订阅名称"
            onChange={event => setName(event.target.value)}
          />
        </Form.Item>
        <Button disabled={!name.trim()} htmlType="submit" loading={creating} type="primary">
          创建订阅地址
        </Button>
      </Form>
      <List<FeedToken>
        bordered
        dataSource={feeds.feeds ?? []}
        loading={!feeds.feeds && !feeds.error}
        locale={{ emptyText: "还没有订阅地址" }}
        renderItem={feed => (
          <List.Item
            actions={[
              <Popconfirm
                key="rotate"
                description="旧地址会立即失效，需要在设备上用新地址重新订阅。"
                title="轮换地址"
                onConfirm={() => void run(() => feeds.rotate(feed.id))}
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
              description={`…/api/feeds/${feed.tokenHint}… · 创建于 ${dateTime(feed.createdAt)}${feed.rotatedAt !== feed.createdAt ? ` · 轮换于 ${dateTime(feed.rotatedAt)}` : ""}`}
              title={feed.name}
            />
          </List.Item>
        )}
      />
      <IssuedFeedModal issued={issued} onClose={() => setIssued(undefined)} />
    </Space>
  );
}
