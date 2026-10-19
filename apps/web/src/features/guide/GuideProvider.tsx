import { type CalendarEvent, type FeedToken, maxPageSize, type PageResult, type PublicUser } from "@timenote/contracts";
import { App, ConfigProvider, type ThemeConfig } from "antd";
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiPath } from "../../api/apiPath.js";
import { api } from "../../api/client.js";
import { GuideContext, type GuideContextValue, type HelpSection } from "./guideContext.js";
import {
  type ChecklistState,
  type GuideProgress,
  type GuideSegment,
  initialChecklistState,
  progressFrom,
  readAutoTourDone,
  readChecklistState,
  writeAutoTourDone,
  writeChecklistState,
} from "./guideState.js";
import { guideSegments } from "./guideSteps.js";
import type { TourExit } from "./GuideTour.js";

const GuideTour = lazy(() => import("./GuideTour.js").then(module => ({ default: module.GuideTour })));
const HelpDrawer = lazy(() => import("./HelpDrawer.js").then(module => ({ default: module.HelpDrawer })));

async function fetchProgress() {
  try {
    const [events, feeds] = await Promise.all([
      api<PageResult<CalendarEvent>>(apiPath("/events", { page: 1, pageSize: 1 })),
      api<PageResult<FeedToken>>(apiPath("/feed-tokens", { page: 1, pageSize: maxPageSize })),
    ]);
    return progressFrom(events.total, feeds);
  } catch {
    // 清单只是辅助信息：读取失败时保留上次结果并返回 undefined，错误由各业务页自己的请求展示。
    return undefined;
  }
}

/** antd Tour 固定开启动画、不读 animated；关掉 motion token 才能让高亮框和抽屉不再过渡。 */
const reducedMotionTheme: ThemeConfig = { token: { motion: false } };

interface RunningTour {
  id: number;
  segment: GuideSegment;
  start: GuideProgress;
}

export function GuideProvider({
  user,
  onNavigate,
  children,
}: {
  user: PublicUser;
  /** 切换页签；引导某段的目标都在固定页签内时，开始前先切过去。 */
  onNavigate: (tab: "events") => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("guide");
  const { message } = App.useApp();
  const [progress, setProgress] = useState<GuideProgress>();
  const [checklist, setChecklist] = useState<ChecklistState | undefined>(() => readChecklistState(user.id));
  const [tour, setTour] = useState<RunningTour>();
  const [pausedSegment, setPausedSegment] = useState<GuideSegment>();
  // 未打开过时不加载帮助抽屉的代码。
  const [help, setHelp] = useState<{ open: boolean; section?: HelpSection }>();
  const pendingTour = useRef<GuideSegment>(undefined);
  const decided = useRef(checklist !== undefined);
  /** 只根据登录后第一次读到的进度决定要不要自动引导，之后删光事件也不会再自动开始。 */
  const sawProgress = useRef(false);
  /** 自动引导的第一段完成后接着开始第二段；用户中途关掉则不再继续。 */
  const chainFeed = useRef(false);
  const tourId = useRef(0);
  const [reduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const apply = useCallback(
    (next: GuideProgress) => {
      setProgress(next);
      // 每个账号在这个浏览器里只自动判断一次是否开启清单，之后只随用户操作变化。
      if (decided.current) {
        return;
      }

      decided.current = true;
      const initial = initialChecklistState(undefined, next);
      if (initial) {
        writeChecklistState(user.id, initial);
        setChecklist(initial);
      }
    },
    [user.id]
  );

  const refresh = useCallback(async () => {
    const next = await fetchProgress();
    if (next) {
      apply(next);
    }

    return next;
  }, [apply]);

  useEffect(() => {
    let active = true;
    const load = () => {
      void fetchProgress().then(next => {
        if (active && next) {
          apply(next);
        }
      });
    };

    // 用户去日历 App 添加订阅后回到网页时重新读取，第 3 步才能及时打勾。
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };

    load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply]);

  const updateChecklist = useCallback(
    (state: ChecklistState) => {
      decided.current = true;
      writeChecklistState(user.id, state);
      setChecklist(state);
    },
    [user.id]
  );

  const launch = useCallback(
    async (segment: GuideSegment) => {
      const start = await refresh();
      if (!start) {
        void message.error(t("tour.unavailable"));
        return false;
      }

      const { startTab } = guideSegments[segment];
      if (startTab) {
        onNavigate(startTab);
      }

      tourId.current += 1;
      setPausedSegment(undefined);
      setTour({ id: tourId.current, segment, start });
      return true;
    },
    [message, onNavigate, refresh, t]
  );

  // 还没有事件、且这个浏览器没自动引导过的账号：登录后依次自动开始两段引导，只此一次。
  useEffect(() => {
    if (!progress || sawProgress.current) {
      return;
    }

    // 等这一帧结束再打开引导，避免和进度更新挤在同一次渲染里。
    const timer = window.setTimeout(() => {
      if (sawProgress.current) {
        return;
      }

      sawProgress.current = true;
      if (progress.eventCount > 0 || readAutoTourDone(user.id)) {
        return;
      }

      chainFeed.current = true;
      void launch("event").then(started => {
        if (started) {
          writeAutoTourDone(user.id);
        } else {
          sawProgress.current = false;
          chainFeed.current = false;
        }
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [launch, progress, user.id]);

  const startTour = useCallback(
    (segment: GuideSegment) => {
      if (help?.open) {
        pendingTour.current = segment;
        setHelp({ open: false });
      } else {
        void launch(segment);
      }
    },
    [help, launch]
  );

  const onTourExit = useCallback(
    (segment: GuideSegment, exit: TourExit) => {
      setTour(undefined);
      const continueToFeed = exit === "finished" && segment === "event" && chainFeed.current;
      chainFeed.current = false;
      if (exit === "paused") {
        setPausedSegment(segment);
        void message.info(t("tour.paused"));
      } else if (exit === "finished") {
        void message.success(t(`tour.${segment}.done`));
        void refresh();
        if (continueToFeed) {
          void launch("feed");
        }
      }
    },
    [launch, message, refresh, t]
  );

  const value = useMemo<GuideContextValue>(
    () => ({
      progress,
      refresh,
      checklistVisible: checklist === "active",
      dismissChecklist: () => updateChecklist("dismissed"),
      showChecklist: () => updateChecklist("active"),
      pausedSegment,
      startTour,
      openHelp: section => setHelp({ open: true, section }),
      isAdmin: user.role === "admin",
    }),
    [checklist, pausedSegment, progress, refresh, startTour, updateChecklist, user.role]
  );

  return (
    <GuideContext value={value}>
      {children}
      <ConfigProvider theme={reduceMotion ? reducedMotionTheme : undefined}>
        {tour ? (
          <Suspense fallback={null}>
            <GuideTour key={tour.id} refresh={refresh} segment={tour.segment} start={tour.start} onExit={onTourExit} />
          </Suspense>
        ) : null}
        {help ? (
          <Suspense fallback={null}>
            <HelpDrawer
              open={help.open}
              section={help.section}
              onClose={() => setHelp({ open: false })}
              onClosed={() => {
                const segment = pendingTour.current;
                pendingTour.current = undefined;
                if (segment) {
                  void launch(segment);
                }
              }}
            />
          </Suspense>
        ) : null}
      </ConfigProvider>
    </GuideContext>
  );
}
