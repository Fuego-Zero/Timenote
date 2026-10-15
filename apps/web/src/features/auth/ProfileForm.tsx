import type { PublicUser } from "@timenote/contracts";
import { App, Button, Form, Input, Select } from "antd";
import { useState } from "react";

import { api, errorMessage } from "../../api/client.js";
import { timeZoneOptions } from "../../lib/timeZones.js";

interface ProfileValues {
  displayName: string;
  timeZone: string;
}

export function ProfileForm({ user, onUserChange }: { user: PublicUser; onUserChange: (user: PublicUser) => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileValues>();
  const [saving, setSaving] = useState(false);

  async function saveProfile(values: ProfileValues) {
    setSaving(true);
    try {
      const data = await api<{ user: PublicUser }>("/auth/profile", "PUT", values);
      onUserChange(data.user);
      void message.success("资料已保存；时区变化会同步影响订阅里的提醒时间");
    } catch (error) {
      void message.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form<ProfileValues>
      form={form}
      initialValues={{ displayName: user.displayName, timeZone: user.timeZone }}
      layout="vertical"
      onFinish={values => void saveProfile(values)}
    >
      <Form.Item label="显示名称" name="displayName">
        <Input maxLength={40} />
      </Form.Item>
      <Form.Item extra="订阅窗口与提醒时刻按此时区计算" label="时区" name="timeZone">
        <Select showSearch options={timeZoneOptions()} />
      </Form.Item>
      <Button htmlType="submit" loading={saving} type="primary">
        保存资料
      </Button>
    </Form>
  );
}
