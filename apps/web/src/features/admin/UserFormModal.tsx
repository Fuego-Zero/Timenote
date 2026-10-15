import type { CreateUserInput } from "@timenote/contracts";
import { Form, Input, Modal, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiRequestError } from "../../api/client.js";
import { timeZoneOptions } from "../../lib/timeZones.js";

export function UserFormModal({
  open,
  defaultTimeZone,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  defaultTimeZone: string;
  onCancel: () => void;
  onSubmit: (input: CreateUserInput) => Promise<void>;
}) {
  const { t } = useTranslation(["admin", "common"]);
  const [form] = Form.useForm<CreateUserInput>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    const values = await form.validateFields();
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit(values);
      form.resetFields();
    } catch (caught) {
      if (caught instanceof ApiRequestError && Object.keys(caught.fields).length) {
        form.setFields(
          Object.entries(caught.fields).map(([name, message]) => ({
            name: name as keyof CreateUserInput,
            errors: [message],
          }))
        );
      } else {
        setError(caught instanceof Error ? caught.message : t("createFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      destroyOnHidden
      confirmLoading={saving}
      okText={t("common:create")}
      open={open}
      title={t("form.title")}
      onCancel={onCancel}
      onOk={() => void submit()}
    >
      <Form<CreateUserInput>
        form={form}
        initialValues={{ role: "user", timeZone: defaultTimeZone, displayName: "" }}
        layout="vertical"
      >
        <Form.Item
          label={t("form.username")}
          name="username"
          rules={[
            { required: true, message: t("form.usernameRequired") },
            { pattern: /^[a-z0-9][a-z0-9_.-]{2,31}$/, message: t("form.usernamePattern") },
          ]}
        >
          <Input autoCapitalize="none" autoComplete="off" />
        </Form.Item>
        <Form.Item label={t("form.displayName")} name="displayName">
          <Input maxLength={40} />
        </Form.Item>
        <Form.Item
          label={t("form.password")}
          name="password"
          rules={[
            { required: true, message: t("form.passwordRequired") },
            { min: 8, max: 128, message: t("form.passwordLength") },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label={t("form.role")} name="role">
          <Select
            options={[
              { label: t("user"), value: "user" },
              { label: t("admin"), value: "admin" },
            ]}
          />
        </Form.Item>
        <Form.Item label={t("form.timeZone")} name="timeZone">
          <Select showSearch options={timeZoneOptions()} />
        </Form.Item>
        {error ? <div role="alert">{error}</div> : null}
      </Form>
    </Modal>
  );
}
