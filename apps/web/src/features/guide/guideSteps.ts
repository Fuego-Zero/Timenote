import type { TourStepProps } from "antd";

import type { GuideProgress, GuideSegment } from "./guideState.js";
import { type GuideTarget, guideTargets } from "./guideTargets.js";

export interface GuideStep {
  /** 需要用户亲自操作：不显示「下一步」，等下一步的目标出现后自动前进。 */
  action?: boolean;
  /** guide 命名空间下 tour.<segment>.<copy>.title / description。 */
  copy: string;
  /**
   * 默认用遮罩挡住高亮区域以外的点击。抽屉、弹窗里的步骤关掉遮罩：它们本身已压暗背景，
   * 用户要边看说明边填写，任何字段都不能被挡住。
   */
  mask?: false;
  placement?: TourStepProps["placement"];
  /** 满足条件时允许跳过本步动作，直接跳到指定目标那一步（例如已有订阅地址时不必再建一个）。 */
  skipTo?: { target: GuideTarget; when: (progress: GuideProgress) => boolean };
  target: GuideTarget;
  /**
   * 目标消失时用服务端数据确认用户确实完成了操作；取消、关闭同样会让目标消失，不能只看 DOM。
   * 确认失败则暂停引导。
   */
  verify?: (start: GuideProgress, now: GuideProgress) => boolean;
}

export interface GuideSegmentDefinition {
  /** 开始前切到的页签；目标都在该页签内时才设置。 */
  startTab?: "events";
  steps: readonly GuideStep[];
}

export const guideSegments: Record<GuideSegment, GuideSegmentDefinition> = {
  event: {
    startTab: "events",
    steps: [
      { target: guideTargets.eventsNew, copy: "new", action: true, placement: "bottomRight" },
      { target: guideTargets.eventKind, copy: "kind", mask: false },
      { target: guideTargets.eventDate, copy: "date", mask: false },
      { target: guideTargets.eventPreview, copy: "preview", mask: false, placement: "left" },
      { target: guideTargets.eventAlarm, copy: "alarm", mask: false, placement: "top" },
      {
        target: guideTargets.eventSave,
        copy: "save",
        action: true,
        mask: false,
        verify: (start, now) => now.eventCount > start.eventCount,
        placement: "topRight",
      },
    ],
  },
  feed: {
    steps: [
      { target: guideTargets.feedsTab, copy: "tab", action: true },
      {
        target: guideTargets.feedsCreate,
        copy: "create",
        action: true,
        skipTo: { target: guideTargets.feedActions, when: progress => progress.feedCount > 0 },
        placement: "bottomRight",
      },
      {
        target: guideTargets.feedForm,
        copy: "form",
        action: true,
        mask: false,
        verify: (start, now) => now.feedCount > start.feedCount,
        placement: "bottom",
      },
      { target: guideTargets.feedActions, copy: "actions", placement: "bottom" },
      { target: guideTargets.feedLastFetched, copy: "fetched", placement: "bottom" },
    ],
  },
};
