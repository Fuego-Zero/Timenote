import type { PublicUser } from "@timenote/contracts";
import { App, Button, Form, Input } from "antd";
import { useState } from "react";

import { api, ApiRequestError, errorMessage } from "../../api/client.js";

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
}

export function ChangePasswordForm({
  user,
  onUserChange,
  forcePasswordChange = false,
  onDone,
}: {
  user: PublicUser;
  onUserChange: (user: PublicUser) => void;
  forcePasswordChange?: boolean;
  onDone?: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordValues>();
  const [saving, setSaving] = useState(false);

  async function changePassword(values: PasswordValues) {
    setSaving(true);
    try {
      await api("/auth/password", "POST", values);
      form.resetFields();
      onUserChange({ ...user, mustChangePassword: false });
      void message.success("密码已修改，其他设备需要重新登录");
      if (forcePasswordChange) {
        onDone?.();
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.currentPassword) {
        form.setFields([{ name: "currentPassword", errors: [error.fields.currentPassword] }]);
      } else {
        void message.error(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form<PasswordValues> form={form} layout="vertical" onFinish={values => void changePassword(values)}>
      <Form.Item label="当前密码" name="currentPassword" rules={[{ required: true, message: "请输入当前密码" }]}>
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Form.Item
        label="新密码"
        name="newPassword"
        rules={[
          { required: true, message: "请输入新密码" },
          { min: 8, max: 128, message: "密码长度为 8-128 位" },
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button htmlType="submit" loading={saving} type="primary">
        修改密码
      </Button>
    </Form>
  );
}
