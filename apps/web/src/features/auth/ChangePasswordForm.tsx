import { App, Button, Form, Input } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ApiRequestError, errorMessage } from "../../api/client.js";

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
}

export function ChangePasswordForm() {
  const { t } = useTranslation("auth");
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordValues>();
  const [saving, setSaving] = useState(false);

  async function changePassword(values: PasswordValues) {
    setSaving(true);
    try {
      await api("/auth/password", "POST", values);
      form.resetFields();
      void message.success(t("password.success"));
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
      <Form.Item
        label={t("password.current")}
        name="currentPassword"
        rules={[{ required: true, message: t("password.currentRequired") }]}
      >
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Form.Item
        label={t("password.next")}
        name="newPassword"
        rules={[
          { required: true, message: t("password.nextRequired") },
          { min: 8, max: 128, message: t("password.length") },
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button htmlType="submit" loading={saving} type="primary">
        {t("password.submit")}
      </Button>
    </Form>
  );
}
