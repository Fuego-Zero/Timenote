import type { EventInput } from "@timenote/contracts";
import { Alert, Button, Col, Divider, Drawer, Grid, Row, Space, theme, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiRequestError, errorMessage } from "../../api/client.js";
import { translateFieldError } from "../../i18n/translateMessage.js";
import { guideTargets } from "../guide/guideTargets.js";
import { draftForSave, draftIssues } from "./eventDraft.js";
import { EventForm } from "./EventForm.js";
import { EventPreview } from "./EventPreview.js";

/** 宽屏左表单右预览（预览 sticky）；窄屏为上表单下预览，中间用分隔线。断点取自 antd Grid。 */
export function EventEditor({
  initial,
  editing,
  timeZone,
  onClose,
  onSave,
}: {
  initial: EventInput;
  editing: boolean;
  timeZone: string;
  onClose: () => void;
  onSave: (draft: EventInput) => Promise<void>;
}) {
  const { t } = useTranslation(["events", "common"]);
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const localErrors = draftIssues(draft);
  // 提交前只在用户尝试保存后标红，避免打开表单就满屏错误；服务端字段错误优先展示。
  const errors = submitted ? { ...localErrors, ...serverErrors } : serverErrors;

  async function save() {
    setSubmitted(true);
    if (Object.keys(localErrors).length) {
      return;
    }

    setSaving(true);
    setSaveError(undefined);
    try {
      await onSave(draftForSave(draft));
    } catch (error) {
      if (error instanceof ApiRequestError && Object.keys(error.fields).length) {
        setServerErrors(
          Object.fromEntries(Object.entries(error.fields).map(([path, field]) => [path, translateFieldError(field)]))
        );
      } else {
        setSaveError(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      destroyOnHidden
      open
      footer={
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>{t("common:cancel")}</Button>
          <Button loading={saving} type="primary" data-guide={guideTargets.eventSave} onClick={() => void save()}>
            {t("common:save")}
          </Button>
        </Space>
      }
      size={screens.md ? 1000 : "100%"}
      title={editing ? t("editEvent") : t("newEvent")}
      onClose={onClose}
    >
      {saveError ? <Alert showIcon style={{ marginBottom: 16 }} title={saveError} type="error" /> : null}
      <Row align="top" gutter={[24, 0]}>
        <Col md={13} xs={24}>
          <EventForm
            draft={draft}
            editing={editing}
            errors={errors}
            timeZone={timeZone}
            onChange={next => {
              setDraft(next);
              setServerErrors({});
            }}
          />
        </Col>
        <Col
          md={11}
          style={
            screens.md ? { position: "sticky", top: 0, maxHeight: "calc(100vh - 160px)", overflow: "auto" } : undefined
          }
          xs={24}
        >
          {screens.md ? null : <Divider />}
          <div
            style={
              screens.md
                ? { paddingInlineStart: token.paddingXS, borderInlineStart: `1px solid ${token.colorBorderSecondary}` }
                : undefined
            }
            data-guide={guideTargets.eventPreview}
          >
            <Typography.Title level={5} styles={{ root: { marginTop: 0 } }}>
              {t("preview.title", { timeZone })}
            </Typography.Title>
            <EventPreview draft={draft} timeZone={timeZone} />
          </div>
        </Col>
      </Row>
    </Drawer>
  );
}
