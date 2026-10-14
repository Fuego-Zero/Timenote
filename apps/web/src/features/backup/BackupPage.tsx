import type { BackupFile, ImportResult } from "@timenote/contracts";
import { App, Button, Space, Typography } from "antd";
import { useRef, useState } from "react";

import { errorMessage } from "../../api/client.js";
import { exportBackupFile } from "./exportBackupFile.js";
import { BackupImportError, importBackup, previewBackup, readBackupFile } from "./importBackupFile.js";

export function BackupPage() {
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
      void message.success(`导入完成：新增 ${result.created}，更新 ${result.updated}`);
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  function confirmImport(backup: BackupFile, preview: ImportResult) {
    modal.confirm({
      title: "确认导入",
      content: `将新增 ${preview.created}、覆盖 ${preview.updated} 个事件。覆盖的事件会被备份中的内容替换，无法撤销。`,
      okText: "导入",
      cancelText: "取消",
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
        备份与恢复
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        导出当前账号的全部事件（含原始日期、规则、模板和提醒）。导入只新增或覆盖同 ID
        的本人事件，不会删除现有数据；导入前会先显示将新增和覆盖的数量，确认后才写入。
      </Typography.Paragraph>
      <Space wrap>
        <Button loading={busy} type="primary" onClick={() => void onExport()}>
          导出 JSON
        </Button>
        <Button loading={busy} onClick={() => fileInput.current?.click()}>
          导入 JSON
        </Button>
        <input
          ref={fileInput}
          hidden
          accept="application/json,.json"
          type="file"
          aria-label="选择备份文件"
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
