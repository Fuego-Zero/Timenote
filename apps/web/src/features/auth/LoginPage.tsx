import type { PublicUser } from "@timenote/contracts";
import { Alert, Button, Card, Flex, Form, Input, Layout, theme, Typography } from "antd";
import { useState } from "react";

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
}: {
  onLogin: (user: PublicUser) => void;
  publicRegisterEnabled: boolean;
}) {
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
                <Typography.Title level={3}>注册申请已提交</Typography.Title>
                <Typography.Paragraph>账号已创建，需管理员启用后才能登录。启用前无法使用本服务。</Typography.Paragraph>
                <Typography.Paragraph type="secondary">请联系站点管理员在「账号管理」中启用。</Typography.Paragraph>
                <Button block type="primary" onClick={goLogin}>
                  返回登录
                </Button>
              </>
            ) : null}

            {mode === "login" ? (
              <>
                <Typography.Title level={3}>岁时记 Timenote</Typography.Title>
                <Typography.Paragraph type="secondary">
                  {publicRegisterEnabled
                    ? "可使用已有账号登录；新用户可注册，注册后需管理员启用才能登录。"
                    : "账号由管理员创建，请使用分配的用户名登录。"}
                </Typography.Paragraph>
                {error ? <Alert showIcon style={{ marginBottom: 16 }} title={error} type="error" /> : null}
                <Form<LoginValues>
                  form={loginForm}
                  layout="vertical"
                  requiredMark={false}
                  onFinish={values => void submitLogin(values)}
                >
                  <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
                    <Input autoCapitalize="none" autoComplete="username" />
                  </Form.Item>
                  <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
                    <Input.Password autoComplete="current-password" />
                  </Form.Item>
                  <Button block htmlType="submit" loading={submitting} type="primary">
                    登录
                  </Button>
                </Form>
                {publicRegisterEnabled ? (
                  <Button block style={{ marginTop: 12 }} type="link" onClick={goRegister}>
                    注册账号
                  </Button>
                ) : null}
              </>
            ) : null}

            {mode === "register" ? (
              <>
                <Typography.Title level={3}>注册账号</Typography.Title>
                <Typography.Paragraph type="secondary">
                  提交后账号默认停用，需管理员启用后才能登录。
                </Typography.Paragraph>
                {error ? <Alert showIcon style={{ marginBottom: 16 }} title={error} type="error" /> : null}
                <Form<RegisterValues>
                  form={registerForm}
                  layout="vertical"
                  requiredMark={false}
                  onFinish={values => void submitRegister(values)}
                >
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[
                      { required: true, message: "请输入用户名" },
                      { pattern: /^[a-z0-9][a-z0-9_.-]{2,31}$/, message: "3-32 位小写字母、数字或 _.-" },
                    ]}
                  >
                    <Input autoCapitalize="none" autoComplete="username" />
                  </Form.Item>
                  <Form.Item label="显示名称" name="displayName">
                    <Input maxLength={40} />
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
                  <Form.Item
                    dependencies={["password"]}
                    label="确认密码"
                    name="confirmPassword"
                    rules={[
                      { required: true, message: "请再次输入密码" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("password") === value) {
                            return Promise.resolve();
                          }

                          return Promise.reject(new Error("两次输入的密码不一致"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  <Button block htmlType="submit" loading={submitting} type="primary">
                    提交注册
                  </Button>
                </Form>
                <Button block style={{ marginTop: 12 }} type="link" onClick={goLogin}>
                  返回登录
                </Button>
              </>
            ) : null}
          </Card>
        </Flex>
      </Layout.Content>
    </Layout>
  );
}
