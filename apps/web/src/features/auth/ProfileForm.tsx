import type { PublicUser } from "@timenote/contracts";
import { App, Button, Form, Input, Radio, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, errorMessage } from "../../api/client.js";
import { localeRegistry, resolveLocale, setLocale } from "../../i18n/index.js";
import { timeZoneOptions } from "../../lib/timeZones.js";

interface ProfileValues {
  displayName: string;
  locale: string;
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
      const data = await api<{ user: PublicUser }>("/auth/profile", "PUT", {
        displayName: values.displayName,
        timeZone: values.timeZone,
      });
      onUserChange(data.user);
      await setLocale(values.locale);
      void message.success(i18n.t("profile.saved", { ns: "auth" }));
    } catch (error) {
      void message.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form<ProfileValues>
      form={form}
      initialValues={{
        displayName: user.displayName,
        timeZone: user.timeZone,
        locale: resolveLocale(i18n.language).code,
      }}
      layout="vertical"
      onFinish={values => void saveProfile(values)}
    >
      <Form.Item label={t("profile.displayName")} name="displayName">
        <Input maxLength={40} />
      </Form.Item>
      <Form.Item extra={t("profile.timeZoneExtra")} label={t("profile.timeZone")} name="timeZone">
        <Select showSearch options={timeZoneOptions()} />
      </Form.Item>
      <Form.Item label={t("common:locale.label")} name="locale">
        <Radio.Group
          block
          buttonStyle="solid"
          options={localeRegistry.map(entry => ({
            value: entry.code,
            label: t(`common:${entry.labelKey}`),
          }))}
          optionType="button"
          aria-label={t("common:locale.label")}
        />
      </Form.Item>
      <Button htmlType="submit" loading={saving} type="primary">
        {t("profile.save")}
      </Button>
    </Form>
  );
}
