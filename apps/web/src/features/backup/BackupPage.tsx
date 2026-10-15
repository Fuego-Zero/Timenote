import type { BackupFile, ImportResult } from "@timenote/contracts";
import { App, Button, Space, Typography } from "antd";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "../../api/client.js";
import { exportBackupFile } from "./exportBackupFile.js";
import { BackupImportError, importBackup, previewBackup, readBackupFile } from "./importBackupFile.js";

export function BackupPage() {
  const { t } = useTranslation(["backup", "common"]);
  const { message, modal } = App.useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function showError(error: unknown) {
    void message.error(error instanceof BackupImportError ? error.message : errorMessage(error));
  }

  async function onExport() {
    setBusy(true);
    try {
      await exportBackupFile();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  /** 失败时提示后继续抛出：onOk 返回被拒绝的 Promise 时确认框保持打开，可直接重试或取消。 */
  async function runImport(backup: BackupFile) {
    try {
      const result = await importBackup(backup);
      void message.success(t("done", { created: result.created, updated: result.updated }));
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  function confirmImport(backup: BackupFile, preview: ImportResult) {
    modal.confirm({
      title: t("confirmTitle"),
      content: t("confirmBody", { created: preview.created, updated: preview.updated }),
      okText: t("importOk"),
      cancelText: t("common:cancel"),
      onOk: () => runImport(backup),
    });
  }

  /** 先本地校验并调用预览（不写库），确认后才真正导入。 */
  async function onPickFile(file: File) {
    setBusy(true);
    try {
      const backup = await readBackupFile(file);
      confirmImport(backup, await previewBackup(backup));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t("title")}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t("intro")}</Typography.Paragraph>
      <Space wrap>
        <Button loading={busy} type="primary" onClick={() => void onExport()}>
          {t("export")}
        </Button>
        <Button loading={busy} onClick={() => fileInput.current?.click()}>
          {t("import")}
        </Button>
        <input
          ref={fileInput}
          hidden
          accept="application/json,.json"
          type="file"
          aria-label={t("pickFile")}
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void onPickFile(file);
            }
          }}
        />
      </Space>
    </Space>
  );
}
