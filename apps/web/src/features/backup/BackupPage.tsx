import { backupFileSchema, type ImportResult } from "@timenote/contracts";
import { Alert, App, Button, Space, Typography } from "antd";
import { useRef, useState } from "react";

import { api, errorMessage } from "../../api/client.js";

export function BackupPage() {
  const { message } = App.useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult>();
  const [busy, setBusy] = useState(false);

  async function exportFile() {
    setBusy(true);
    try {
      const backup = await api<unknown>("/backup");
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `timenote-backup-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      void message.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setResult(undefined);
    try {
      const parsed = backupFileSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        void message.error("文件不是有效的 timenote 备份");
        return;
      }

      setResult(await api<ImportResult>("/backup", "POST", parsed.data));
    } catch (error) {
      void message.error(error instanceof SyntaxError ? "文件不是有效的 JSON" : errorMessage(error));
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
        <Button loading={busy} type="primary" onClick={() => void exportFile()}>
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
              void importFile(file);
            }
          }}
        />
      </Space>
      {result ? (
        <Alert showIcon title={`导入完成：新增 ${result.created} 个，更新 ${result.updated} 个`} type="success" />
      ) : null}
    </Space>
  );
}
