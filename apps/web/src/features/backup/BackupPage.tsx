import { App, Button, Space, Typography } from "antd";
import { useRef, useState } from "react";

import { errorMessage } from "../../api/client.js";
import { exportBackupFile } from "./exportBackupFile.js";
import { BackupImportError, importBackupFile } from "./importBackupFile.js";

export function BackupPage() {
  const { message } = App.useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      await exportBackupFile();
    } catch (error) {
      void message.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function onImport(file: File) {
    setBusy(true);
    try {
      const result = await importBackupFile(file);
      void message.success(`导入完成：新增 ${result.created}，更新 ${result.updated}`);
    } catch (error) {
      void message.error(error instanceof BackupImportError ? error.message : errorMessage(error));
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
        导出当前账号的全部事件（含原始日期、规则、模板和提醒）。导入只新增或覆盖同 ID 的本人事件，不会删除现有数据。
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
              void onImport(file);
            }
          }}
        />
      </Space>
    </Space>
  );
}
