import type { PublicUser } from "@timenote/contracts";
import { App, Button, Divider, Form, Input, Modal, Select } from "antd";
import { useState } from "react";

import { api, ApiRequestError, errorMessage } from "../../api/client.js";
import { timeZoneOptions } from "../../lib/timeZones.js";

interface ProfileValues {
  displayName: string;
  timeZone: string;
}

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
}

export function AccountModal({
  user,
  open,
  onClose,
  onUserChange,
  forcePasswordChange = false,
}: {
  user: PublicUser;
  open: boolean;
  onClose: () => void;
  onUserChange: (user: PublicUser) => void;
  forcePasswordChange?: boolean;
}) {
  const { message } = App.useApp();
  const [profileForm] = Form.useForm<ProfileValues>();
  const [passwordForm] = Form.useForm<PasswordValues>();
  const [saving, setSaving] = useState<"profile" | "password">();

  async function saveProfile(values: ProfileValues) {
    setSaving("profile");
    try {
      const data = await api<{ user: PublicUser }>("/auth/profile", "PUT", values);
      onUserChange(data.user);
      void message.success("资料已保存；时区变化会同步影响订阅里的提醒时间");
    } catch (error) {
      void message.error(errorMessage(error));
    } finally {
      setSaving(undefined);
    }
  }

  async function changePassword(values: PasswordValues) {
    setSaving("password");
    try {
      await api("/auth/password", "POST", values);
      passwordForm.resetFields();
      onUserChange({ ...user, mustChangePassword: false });
      void message.success("密码已修改，其他设备需要重新登录");
      if (forcePasswordChange) {
        onClose();
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.currentPassword) {
        passwordForm.setFields([{ name: "currentPassword", errors: [error.fields.currentPassword] }]);
      } else {
        void message.error(errorMessage(error));
      }
    } finally {
      setSaving(undefined);
    }
  }

  return (
    <Modal
      closable={!forcePasswordChange}
      destroyOnHidden
      footer={null}
      keyboard={!forcePasswordChange}
      maskClosable={!forcePasswordChange}
      open={open}
      title={forcePasswordChange ? "请先修改初始密码" : "账号设置"}
      onCancel={forcePasswordChange ? undefined : onClose}
    >
      {forcePasswordChange ? null : (
        <>
          <Form<ProfileValues>
            form={profileForm}
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
            <Button htmlType="submit" loading={saving === "profile"} type="primary">
              保存资料
            </Button>
          </Form>
          <Divider />
        </>
      )}
      <Form<PasswordValues> form={passwordForm} layout="vertical" onFinish={values => void changePassword(values)}>
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
        <Button htmlType="submit" loading={saving === "password"} type="primary">
          修改密码
        </Button>
      </Form>
    </Modal>
  );
}
