import type { PublicUser } from "@timenote/contracts";
import { Alert, Button, Card, Flex, Form, Input, Layout, theme, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ApiRequestError, errorMessage } from "../../api/client.js";
import { translateFieldError } from "../../i18n/translateMessage.js";

interface SetupValues {
  displayName?: string;
  password: string;
  username: string;
}

export function SetupPage({ onReady }: { onReady: (user: PublicUser) => void }) {
  const { t } = useTranslation("auth");
  const { token } = theme.useToken();
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
        setError(translateFieldError(caught.fields.password));
      } else {
        setError(errorMessage(caught));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Content>
        <Flex align="center" justify="center" style={{ minHeight: "100vh", padding: token.padding }}>
          <Card style={{ maxWidth: 380, width: "100%" }}>
            <Typography.Title level={3}>{t("setup.title")}</Typography.Title>
            <Typography.Paragraph type="secondary">{t("setup.hint")}</Typography.Paragraph>
            {error ? <Alert showIcon style={{ marginBottom: 16 }} title={error} type="error" /> : null}
            <Form<SetupValues> layout="vertical" requiredMark={false} onFinish={values => void submit(values)}>
              <Form.Item
                label={t("setup.username")}
                name="username"
                rules={[{ required: true, message: t("setup.usernameRequired") }]}
              >
                <Input autoCapitalize="none" autoComplete="username" />
              </Form.Item>
              <Form.Item label={t("setup.displayName")} name="displayName">
                <Input maxLength={40} placeholder={t("setup.displayNamePlaceholder")} />
              </Form.Item>
              <Form.Item
                label={t("setup.password")}
                name="password"
                rules={[
                  { required: true, message: t("setup.passwordRequired") },
                  { min: 8, max: 128, message: t("setup.passwordLength") },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button block htmlType="submit" loading={submitting} type="primary">
                {t("setup.submit")}
              </Button>
            </Form>
          </Card>
        </Flex>
      </Layout.Content>
    </Layout>
  );
}
