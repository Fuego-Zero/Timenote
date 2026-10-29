import { type FeedbackInstance, init } from "@echo-feedback/sdk";
import type { FeedbackClientConfig } from "@timenote/contracts";
import { Button } from "antd";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { version as projectVersion } from "../../../package.json";
import { readCspNonce } from "../../lib/nonce.js";

export function FeedbackButton({ ak, serverUrl, userId }: FeedbackClientConfig & { userId: string }) {
  const { t } = useTranslation("common");
  const instance = useRef<FeedbackInstance | null>(null);

  useEffect(() => {
    const nonce = readCspNonce();
    const feedback = init({
      serverUrl,
      ak,
      showTrigger: false,
      // 岁时记界面固定浅色；面板主色与 AppProviders 的 colorPrimary 一致。
      theme: "light",
      uiStyle: "paper",
      primaryColor: "#d6246e",
      nonce: nonce || undefined,
      projectVersion,
      onError(error) {
        console.warn("回声 SDK 异常", error.message);
      },
    });
    instance.current = feedback;
    return () => {
      instance.current = null;
      feedback.destroy();
    };
  }, [ak, serverUrl]);

  return <Button onClick={() => instance.current?.open({ userId, projectVersion })}>{t("nav.feedback")}</Button>;
}
