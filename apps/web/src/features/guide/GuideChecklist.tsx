import { Alert, Button, Card, Grid, Steps, type StepsProps, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { type GuideSegment, progressDone } from "./guideState.js";
import { useGuide } from "./useGuide.js";

interface ChecklistItem {
  done: boolean;
  key: "event" | "feed" | "fetched";
  /** 有引导的步骤；「在日历 App 里订阅」发生在应用外，只打开帮助说明。 */
  segment?: GuideSegment;
}

/** 「开始使用」清单：进度来自真实数据，每一步可以按需启动对应引导。只在页面流内展示，不弹遮罩。 */
export function GuideChecklist() {
  const { t } = useTranslation("guide");
  const guide = useGuide();
  const screens = Grid.useBreakpoint();
  const { progress } = guide;
  if (!guide.checklistVisible || !progress) {
    return null;
  }

  if (progressDone(progress)) {
    return (
      <Alert
        showIcon
        closable={{ onClose: guide.dismissChecklist }}
        description={t("checklist.doneBody")}
        style={{ marginBottom: 12 }}
        title={t("checklist.doneTitle")}
        type="success"
      />
    );
  }

  const items: ChecklistItem[] = [
    { key: "event", done: progress.eventCount > 0, segment: "event" },
    { key: "feed", done: progress.feedCount > 0, segment: "feed" },
    { key: "fetched", done: progress.fetched },
  ];
  const firstOpen = items.findIndex(item => !item.done);

  function actionLabel(item: ChecklistItem) {
    if (!item.segment) {
      return t("checklist.howTo");
    }

    if (guide.pausedSegment === item.segment) {
      return t("checklist.resume");
    }

    return item.done ? t("checklist.again") : t("checklist.start");
  }

  function status(item: ChecklistItem, index: number) {
    if (item.done) {
      return "finish";
    }

    return index === firstOpen ? "process" : "wait";
  }

  const steps: StepsProps["items"] = items.map((item, index) => ({
    title: t(`checklist.${item.key}.title`),
    status: status(item, index),
    content: (
      <>
        <Typography.Text type="secondary">{t(`checklist.${item.key}.content`)}</Typography.Text>
        <div>
          <Button
            size="small"
            style={{ paddingInline: 0 }}
            type="link"
            onClick={() => (item.segment ? guide.startTour(item.segment) : guide.openHelp("calendar"))}
          >
            {actionLabel(item)}
          </Button>
        </div>
      </>
    ),
  }));

  return (
    <Card
      extra={
        <Button size="small" type="link" onClick={guide.dismissChecklist}>
          {t("checklist.dismiss")}
        </Button>
      }
      role="region"
      size="small"
      style={{ marginBottom: 12 }}
      title={t("checklist.title")}
      aria-label={t("checklist.title")}
    >
      <Typography.Paragraph type="secondary">{t("checklist.subtitle")}</Typography.Paragraph>
      <Steps items={steps} orientation={screens.md ? "horizontal" : "vertical"} size="small" />
      {guide.isAdmin ? (
        <Typography.Paragraph style={{ marginBottom: 0, marginTop: 12 }} type="secondary">
          {t("checklist.adminTip")}
        </Typography.Paragraph>
      ) : null}
    </Card>
  );
}
