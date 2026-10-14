import type { CreateUserInput } from "@timenote/contracts";
import { Form, Input, Modal, Select } from "antd";
import { useState } from "react";

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
        setError(caught instanceof Error ? caught.message : "创建失败");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      destroyOnHidden
      confirmLoading={saving}
      okText="创建"
      open={open}
      title="新建账号"
      onCancel={onCancel}
      onOk={() => void submit()}
    >
      <Form<CreateUserInput>
        form={form}
        initialValues={{ role: "user", timeZone: defaultTimeZone, displayName: "" }}
        layout="vertical"
      >
        <Form.Item
          label="用户名"
          name="username"
          rules={[
            { required: true, message: "请输入用户名" },
            { pattern: /^[a-z0-9][a-z0-9_.-]{2,31}$/, message: "3-32 位小写字母、数字或 _.-" },
          ]}
        >
          <Input autoCapitalize="none" autoComplete="off" />
        </Form.Item>
        <Form.Item label="显示名称" name="displayName">
          <Input maxLength={40} />
        </Form.Item>
        <Form.Item
          label="初始密码"
          name="password"
          rules={[
            { required: true, message: "请输入初始密码" },
            { min: 8, max: 128, message: "密码长度为 8-128 位" },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item label="角色" name="role">
          <Select
            options={[
              { label: "普通用户", value: "user" },
              { label: "管理员", value: "admin" },
            ]}
          />
        </Form.Item>
        <Form.Item label="时区" name="timeZone">
          <Select showSearch options={timeZoneOptions()} />
        </Form.Item>
        {error ? <div role="alert">{error}</div> : null}
      </Form>
    </Modal>
  );
}
