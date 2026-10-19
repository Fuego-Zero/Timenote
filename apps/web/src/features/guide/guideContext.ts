import { createContext } from "react";

import type { GuideProgress, GuideSegment } from "./guideState.js";

export type HelpSection = "calendar" | "faq" | "intro" | "tours";

export interface GuideContextValue {
  checklistVisible: boolean;
  dismissChecklist: () => void;
  isAdmin: boolean;
  openHelp: (section?: HelpSection) => void;
  /** 被暂停的那一段，清单上显示「继续」。 */
  pausedSegment: GuideSegment | undefined;
  /** 尚未加载或加载失败时为 undefined，此时不显示清单。 */
  progress: GuideProgress | undefined;
  /** 重新读取事件与订阅数量；业务页在新增、删除后调用，清单随之打勾。 */
  refresh: () => Promise<GuideProgress | undefined>;
  showChecklist: () => void;
  startTour: (segment: GuideSegment) => void;
}

export const GuideContext = createContext<GuideContextValue | null>(null);
