import type { PublicUser } from "@timenote/contracts";
import { Alert, Button, Card, Flex, Form, Input, Layout, theme, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, errorMessage } from "../../api/client.js";

interface LoginValues {
  password: string;
  username: string;
}

export function LoginPage({ onLogin }: { onLogin: (user: PublicUser) => void }) {
  const { t } = useTranslation(["auth", "common"]);
  const { token } = theme.useToken();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: LoginValues) {
    setSubmitting(true);
    setError(undefined);
    try {
      const data = await api<{ user: PublicUser }>("/auth/login", "POST", values);
      onLogin(data.user);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Content>
        <Flex align="center" justify="center" style={{ minHeight: "100vh", padding: token.padding }}>
          <Card style={{ maxWidth: 380, width: "100%" }}>
            <Typography.Title level={3}>{t("common:brand")}</Typography.Title>
            <Typography.Paragraph type="secondary">{t("login.hint")}</Typography.Paragraph>
            {error ? <Alert showIcon style={{ marginBottom: 16 }} title={error} type="error" /> : null}
            <Form<LoginValues> layout="vertical" requiredMark={false} onFinish={values => void submit(values)}>
              <Form.Item
                label={t("login.username")}
                name="username"
                rules={[{ required: true, message: t("login.usernameRequired") }]}
              >
                <Input autoCapitalize="none" autoComplete="username" />
              </Form.Item>
              <Form.Item
                label={t("login.password")}
                name="password"
                rules={[{ required: true, message: t("login.passwordRequired") }]}
              >
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">
                {t("login.submit")}
              </Button>
            </Form>
          </Card>
        </Flex>
      </Layout.Content>
    </Layout>
  );
}
