import type { FeedEventScope, FeedToken, PublicUser } from "@timenote/contracts";
import { Alert, Form, Input, Modal, Radio } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "../../api/client.js";
import { guideTargets } from "../guide/guideTargets.js";
import { EventPicker } from "./EventPicker.js";

export interface FeedDraft {
  calendarName: string;
  eventIds: string[];
  eventScope: FeedEventScope;
  name: string;
}

/** 旧订阅没有自定义名时，服务端仍用中文默认名，不因后来切换语言而改写。 */
function storedCalendarName(user: PublicUser) {
  return `${user.displayName || user.username}的纪念日`;
}

/** 新建与编辑订阅共用的弹窗；保存失败（如所选事件已被删除返回 400）时在弹窗内提示并刷新选择器。 */
export function FeedFormModal({
  feed,
  onCancel,
  onSubmit,
  user,
}: {
  /** 为空时是新建。 */
  feed?: FeedToken;
  onCancel: () => void;
  onSubmit: (draft: FeedDraft) => Promise<void>;
  user: PublicUser;
}) {
  const { t } = useTranslation(["feeds", "common"]);
  const [draft, setDraft] = useState<FeedDraft>(() =>
    feed
      ? {
          name: feed.name,
          calendarName: feed.calendarName ?? "",
          eventScope: feed.eventScope,
          eventIds: feed.eventIds,
        }
      : { name: t("form.defaultDeviceName"), calendarName: "", eventScope: "all", eventIds: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [reloadKey, setReloadKey] = useState(0);
  const title = feed ? t("edit") : t("create");
  const localizedDefault = t("form.defaultCalendarName", { name: user.displayName || user.username });
  const previewName =
    draft.calendarName.trim() || (feed ? (feed.calendarName ?? storedCalendarName(user)) : localizedDefault);

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit({
        name: draft.name.trim(),
        // 新建时把当时语言的默认名写进订阅；编辑时留空仍表示清空自定义，不改已有默认名的语言。
        calendarName: draft.calendarName.trim() || (feed ? "" : localizedDefault),
        eventScope: draft.eventScope,
        eventIds: draft.eventScope === "selected" ? draft.eventIds : [],
      });
    } catch (submitError) {
      setError(submitError);
      setReloadKey(key => key + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      confirmLoading={saving}
      // 引导高亮整张弹窗，用户才能在遮罩下点到「创建」。
      modalRender={node => <div data-guide={feed ? undefined : guideTargets.feedForm}>{node}</div>}
      okButtonProps={{ disabled: !draft.name.trim() }}
      okText={feed ? t("common:save") : t("common:create")}
      title={title}
      width={720}
      onCancel={onCancel}
      onOk={() => void submit()}
    >
      <Form layout="vertical">
        {Boolean(error) && <Alert showIcon style={{ marginBottom: 16 }} title={errorMessage(error)} type="error" />}
        <Form.Item extra={t("form.deviceExtra")} label={t("form.deviceName")}>
          <Input
            maxLength={30}
            placeholder={t("form.devicePlaceholder")}
            value={draft.name}
            aria-label={t("form.deviceAria")}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          />
        </Form.Item>
        <Form.Item extra={t("form.calendarExtra", { name: previewName })} label={t("form.calendarName")}>
          <Input
            maxLength={40}
            placeholder={t("form.calendarPlaceholder", {
              name: feed ? (feed.calendarName ?? storedCalendarName(user)) : localizedDefault,
            })}
            value={draft.calendarName}
            aria-label={t("form.calendarAria")}
            onChange={event => setDraft(current => ({ ...current, calendarName: event.target.value }))}
          />
        </Form.Item>
        <Form.Item label={t("form.eventScope")}>
          <Radio.Group
            value={draft.eventScope}
            onChange={event => setDraft(current => ({ ...current, eventScope: event.target.value as FeedEventScope }))}
          >
            <Radio value="all">{t("form.allEvents")}</Radio>
            <Radio value="selected">{t("form.selectedEvents")}</Radio>
          </Radio.Group>
        </Form.Item>
        {draft.eventScope === "selected" && (
          <Form.Item label={t("form.pickEvents")}>
            <EventPicker
              reloadKey={reloadKey}
              value={draft.eventIds}
              onChange={eventIds => setDraft(current => ({ ...current, eventIds }))}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
