import type { PublicUser } from "@timenote/contracts";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useState } from "react";

import { api, ApiRequestError, errorMessage } from "../../api/client.js";

interface SetupValues {
  password: string;
  username: string;
  displayName?: string;
}

export function SetupPage({ onReady }: { onReady: (user: PublicUser) => void }) {
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: SetupValues) {
    setSubmitting(true);
    setError(undefined);
    try {
      const data = await api<{ user: PublicUser }>("/setup/admin", "POST", values);
      onReady(data.user);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.fields.password) {
        setError(caught.fields.password);
      } else {
        setError(errorMessage(caught));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <Card className="login-card">
        <Typography.Title level={3}>首次设置管理员</Typography.Title>
        <Typography.Paragraph type="secondary">
          当前还没有管理员账号。请设置用户名和密码，完成后会自动登录。
        </Typography.Paragraph>
        {error ? <Alert showIcon style={{ marginBottom: 16 }} title={error} type="error" /> : null}
        <Form<SetupValues> layout="vertical" requiredMark={false} onFinish={values => void submit(values)}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input autoCapitalize="none" autoComplete="username" />
          </Form.Item>
          <Form.Item label="显示名称" name="displayName">
            <Input maxLength={40} placeholder="管理员" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 8, max: 128, message: "密码长度为 8-128 位" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button block htmlType="submit" loading={submitting} type="primary">
            创建并进入
          </Button>
        </Form>
      </Card>
    </main>
  );
}
