import type { PublicUser } from "@timenote/contracts";
import { Alert, Button, Card, Flex, Form, Input, Layout, theme, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, errorMessage } from "../../api/client.js";

interface LoginValues {
  password: string;
  username: string;
}

interface RegisterValues {
  confirmPassword: string;
  displayName?: string;
  password: string;
  username: string;
}

type Mode = "login" | "register" | "registerSuccess";

export function LoginPage({
  onLogin,
  publicRegisterEnabled,
  registerDefaultDisabled,
}: {
  onLogin: (user: PublicUser) => void;
  publicRegisterEnabled: boolean;
  registerDefaultDisabled: boolean;
}) {
  const { t } = useTranslation(["auth", "common"]);
  const { token } = theme.useToken();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [loginForm] = Form.useForm<LoginValues>();
  const [registerForm] = Form.useForm<RegisterValues>();

  async function submitLogin(values: LoginValues) {
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

  async function submitRegister(values: RegisterValues) {
    setSubmitting(true);
    setError(undefined);
    try {
      await api("/auth/register", "POST", {
        username: values.username,
        password: values.password,
        displayName: values.displayName,
      });
      setMode("registerSuccess");
      registerForm.resetFields();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function goLogin() {
    setError(undefined);
    setMode("login");
  }

  function goRegister() {
    setError(undefined);
    setMode("register");
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Content>
        <Flex align="center" justify="center" style={{ minHeight: "100vh", padding: token.padding }}>
          <Card style={{ maxWidth: 380, width: "100%" }}>
            {mode === "registerSuccess" ? (
              <>
                <Typography.Title level={3}>
                  {registerDefaultDisabled ? t("register.pendingTitle") : t("register.successTitle")}
                </Typography.Title>
                <Typography.Paragraph>
                  {registerDefaultDisabled ? t("register.pendingBody") : t("register.successBody")}
                </Typography.Paragraph>
                {registerDefaultDisabled ? (
                  <Typography.Paragraph type="secondary">{t("register.pendingHint")}</Typography.Paragraph>
                ) : null}
                <Button block type="primary" onClick={goLogin}>
                  {t("register.back")}
                </Button>
              </>
            ) : null}

            {mode === "login" ? (
              <>
                <Typography.Title level={3}>{t("common:brand")}</Typography.Title>
                <Typography.Paragraph type="secondary">{t("login.welcome")}</Typography.Paragraph>
                {error ? <Alert showIcon style={{ marginBottom: 16 }} title={error} type="error" /> : null}
                <Form<LoginValues>
                  form={loginForm}
                  layout="vertical"
                  requiredMark={false}
                  onFinish={values => void submitLogin(values)}
                >
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
                {publicRegisterEnabled ? (
                  <Button block style={{ marginTop: 12 }} type="link" onClick={goRegister}>
                    {t("login.register")}
                  </Button>
                ) : null}
              </>
            ) : null}

            {mode === "register" ? (
              <>
                <Typography.Title level={3}>{t("register.title")}</Typography.Title>
                <Typography.Paragraph type="secondary">
                  {registerDefaultDisabled ? t("register.pendingForm") : t("register.readyForm")}
                </Typography.Paragraph>
                {error ? <Alert showIcon style={{ marginBottom: 16 }} title={error} type="error" /> : null}
                <Form<RegisterValues>
                  form={registerForm}
                  layout="vertical"
                  requiredMark={false}
                  onFinish={values => void submitRegister(values)}
                >
                  <Form.Item
                    label={t("register.username")}
                    name="username"
                    rules={[
                      { required: true, message: t("register.usernameRequired") },
                      { pattern: /^[a-z0-9][a-z0-9_.-]{2,31}$/, message: t("register.usernamePattern") },
                    ]}
                  >
                    <Input autoCapitalize="none" autoComplete="username" />
                  </Form.Item>
                  <Form.Item label={t("register.displayName")} name="displayName">
                    <Input maxLength={40} />
                  </Form.Item>
                  <Form.Item
                    label={t("register.password")}
                    name="password"
                    rules={[
                      { required: true, message: t("register.passwordRequired") },
                      { min: 8, max: 128, message: t("register.passwordLength") },
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Form.Item
                    dependencies={["password"]}
                    label={t("register.confirm")}
                    name="confirmPassword"
                    rules={[
                      { required: true, message: t("register.confirmRequired") },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("password") === value) {
                            return Promise.resolve();
                          }

                          return Promise.reject(new Error(t("register.confirmMismatch")));
                        },
                      }),
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Button block htmlType="submit" loading={submitting} type="primary">
                    {t("register.submit")}
                  </Button>
                </Form>
                <Button block style={{ marginTop: 12 }} type="link" onClick={goLogin}>
                  {t("register.back")}
                </Button>
              </>
            ) : null}
          </Card>
        </Flex>
      </Layout.Content>
    </Layout>
  );
}
