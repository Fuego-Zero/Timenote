import type { PublicUser } from "@timenote/contracts";
import { App, Button, Form, Input, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, errorMessage } from "../../api/client.js";
import { localeRegistry, setLocale } from "../../i18n/index.js";
import { timeZoneOptions } from "../../lib/timeZones.js";

interface ProfileValues {
  displayName: string;
  timeZone: string;
}

export function ProfileForm({ user, onUserChange }: { user: PublicUser; onUserChange: (user: PublicUser) => void }) {
  const { t, i18n } = useTranslation(["auth", "common"]);
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileValues>();
  const [saving, setSaving] = useState(false);

  async function saveProfile(values: ProfileValues) {
    setSaving(true);
    try {
      const data = await api<{ user: PublicUser }>("/auth/profile", "PUT", values);
      onUserChange(data.user);
      void message.success(t("profile.saved"));
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
      <Form.Item label={t("profile.displayName")} name="displayName">
        <Input maxLength={40} />
      </Form.Item>
      <Form.Item extra={t("profile.timeZoneExtra")} label={t("profile.timeZone")} name="timeZone">
        <Select showSearch options={timeZoneOptions()} />
      </Form.Item>
      <Form.Item label={t("common:locale.label")}>
        <Select
          options={localeRegistry.map(entry => ({
            value: entry.code,
            label: t(`common:${entry.labelKey}`),
          }))}
          value={i18n.language}
          aria-label={t("common:locale.label")}
          onChange={code => void setLocale(code)}
        />
      </Form.Item>
      <Button htmlType="submit" loading={saving} type="primary">
        {t("profile.save")}
      </Button>
    </Form>
  );
}
