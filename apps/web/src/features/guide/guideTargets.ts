/** 引导高亮目标的 data-guide 取值；业务组件在对应元素上写 data-guide={guideTargets.x}，引导只按它查找元素。 */
export const guideTargets = {
  eventsNew: "events-new",
  eventKind: "event-kind",
  eventDate: "event-date",
  eventPreview: "event-preview",
  eventAlarm: "event-alarm",
  eventSave: "event-save",
  feedsTab: "feeds-tab",
  feedsCreate: "feeds-create",
  feedForm: "feed-form",
  feedActions: "feed-actions",
  feedLastFetched: "feed-last-fetched",
} as const;

export type GuideTarget = (typeof guideTargets)[keyof typeof guideTargets];

export function findGuideTarget(target: GuideTarget): HTMLElement | null {
  const element = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
  // 已卸载或被 display:none 隐藏的元素没有布局盒，不能作为高亮目标。
  return element && element.getClientRects().length > 0 ? element : null;
}
