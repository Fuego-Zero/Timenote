import type { IssuedFeed } from "@timenote/contracts";
import { Alert, App, Button, Modal, Space, Typography } from "antd";

/** 完整订阅地址只在创建或轮换时显示这一次；服务端只保存摘要，关闭后无法再次查看。 */
export function IssuedFeedModal({ issued, onClose }: { issued: IssuedFeed | undefined; onClose: () => void }) {
  const { message } = App.useApp();

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      void message.success("已复制订阅地址");
    } catch {
      void message.warning("无法自动复制，请长按地址手动复制");
    }
  }

  return (
    <Modal
      destroyOnHidden
      footer={<Button onClick={onClose}>完成</Button>}
      open={Boolean(issued)}
      title="订阅地址"
      onCancel={onClose}
    >
      {issued ? (
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Alert showIcon title="地址只显示这一次，请立即复制保存。任何拿到地址的人都能看到你的事件。" type="warning" />
          <Typography.Paragraph code className="feed-url" copyable={false}>
            {issued.url}
          </Typography.Paragraph>
          <Space wrap>
            <Button type="primary" onClick={() => void copy(issued.url)}>
              复制 HTTPS 地址
            </Button>
            <Button href={issued.webcalUrl}>用日历 App 打开（webcal）</Button>
          </Space>
          <Typography.Paragraph type="secondary">
            iPhone：设置 → 日历 → 账户 → 添加账户 → 其他 → 添加已订阅的日历，粘贴地址。日历 App
            定期刷新，修改后不会立即出现。
          </Typography.Paragraph>
        </Space>
      ) : null}
    </Modal>
  );
}
