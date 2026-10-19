import { Button, Space, theme, Tour, Typography } from "antd";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GuideProgress, GuideSegment } from "./guideState.js";
import { guideSegments } from "./guideSteps.js";
import { findGuideTarget } from "./guideTargets.js";

export type TourExit = "closed" | "finished" | "paused";

/** 目标短暂消失（重渲染、列表重新加载）不立即暂停，超过这个时长才认为用户已离开这一步。 */
const missingGraceMs = 1500;
/** 抽屉、弹窗进场动画期间逐帧重算高亮位置的时长。 */
const settleMs = 700;

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

/** antd Tour 只在窗口 resize / scroll 时重算高亮位置；抽屉内滚动、动画和布局变化需要补发一次。 */
function requestRealign() {
  window.dispatchEvent(new Event("scroll"));
}

/**
 * 一段聚焦引导。只高亮和解释，从不替用户填写、保存或打开外部链接：需要操作的步骤等用户自己完成，
 * 目标消失（关掉抽屉、切换页签）时撤掉遮罩并暂停，不会把页面挡住。
 */
export function GuideTour({
  segment,
  start,
  refresh,
  onExit,
}: {
  segment: GuideSegment;
  /** 开始时的进度，用于确认「这次」确实新建了事件或订阅。 */
  start: GuideProgress;
  refresh: () => Promise<GuideProgress | undefined>;
  /** 需保持引用稳定：它变化会重建页面监听。 */
  onExit: (segment: GuideSegment, exit: TourExit) => void;
}) {
  const { t } = useTranslation("guide");
  const { steps } = guideSegments[segment];
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [latest, setLatest] = useState(start);
  const [opener] = useState(() => document.activeElement);
  const { token } = theme.useToken();
  const exited = useRef(false);
  const step = steps[current];
  const next = steps[current + 1];

  const exit = useCallback(
    (reason: TourExit) => {
      if (exited.current) {
        return;
      }

      exited.current = true;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }

      onExit(segment, reason);
    },
    [onExit, opener, segment]
  );

  // 跟随页面变化决定前进、显示、等待或暂停。
  useEffect(() => {
    let missingSince: number | undefined;
    let verifying = false;
    let cancelled = false;
    let frame = 0;
    let timer: number | undefined;

    function evaluate() {
      if (exited.current || verifying || cancelled) {
        return;
      }

      if (step.action && !step.verify && next && findGuideTarget(next.target)) {
        setCurrent(current + 1);
        return;
      }

      if (findGuideTarget(step.target)) {
        missingSince = undefined;
        setVisible(true);
        return;
      }

      setVisible(false);
      if (step.verify) {
        const { verify } = step;
        verifying = true;
        void refresh().then(now => {
          if (cancelled) {
            return;
          }

          if (!now || !verify(start, now)) {
            exit("paused");
          } else if (next) {
            setLatest(now);
            setCurrent(current + 1);
          } else {
            exit("finished");
          }
        });
        return;
      }

      missingSince ??= Date.now();
      if (Date.now() - missingSince >= missingGraceMs) {
        exit("paused");
        return;
      }

      window.clearTimeout(timer);
      timer = window.setTimeout(evaluate, missingGraceMs);
    }

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(evaluate);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    evaluate();
    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [current, exit, next, refresh, start, step]);

  // 目标位置变化时让 Tour 重算高亮框。
  useEffect(() => {
    const element = visible ? findGuideTarget(step.target) : null;
    if (!element) {
      return;
    }

    let last = "";
    let frame = 0;
    const realignIfMoved = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const key = `${rect.left},${rect.top},${rect.width},${rect.height}`;
        // 比视口还高的目标永远「不在视口内」，Tour 会反复 scrollIntoView，用户就没法滚动，此时不补发。
        if (key !== last && rect.height <= window.innerHeight) {
          last = key;
          requestRealign();
        }
      });
    };

    const resize = new ResizeObserver(realignIfMoved);
    resize.observe(element);
    resize.observe(document.body);
    document.addEventListener("scroll", realignIfMoved, true);
    const settleUntil = performance.now() + settleMs;
    let settleFrame = 0;
    const settle = () => {
      realignIfMoved();
      if (performance.now() < settleUntil) {
        settleFrame = requestAnimationFrame(settle);
      }
    };

    settleFrame = requestAnimationFrame(settle);
    return () => {
      resize.disconnect();
      document.removeEventListener("scroll", realignIfMoved, true);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
    };
  }, [step.target, visible]);

  const skipIndex = step.skipTo?.when(latest)
    ? steps.findIndex(candidate => candidate.target === step.skipTo?.target)
    : -1;
  const previous = steps[current - 1];
  const canGoBack = Boolean(previous && !previous.action);
  const canGoForward = !step.action || skipIndex > 0;
  const last = current === steps.length - 1;
  const title = t(`tour.${segment}.${step.copy}.title`);
  const description = t(`tour.${segment}.${step.copy}.description`);

  function forwardLabel() {
    if (skipIndex > 0) {
      return t("tour.skipToExisting");
    }

    return last ? t("tour.finish") : t("tour.next");
  }

  function goForward() {
    if (skipIndex > 0) {
      setCurrent(skipIndex);
    } else if (last) {
      exit("finished");
    } else {
      setCurrent(current + 1);
    }
  }

  return (
    <>
      {/* 高亮框和抽屉、弹窗的 z-index 相同，且先挂到页面上，会被后打开的弹窗盖住。
          抬高一层只画出描边：抽屉内的步骤没有遮罩，否则表单无法填写。 */}
      <style>{`
        .ant-tour-target-placeholder {
          z-index: ${token.zIndexPopupBase + 101};
          border-radius: ${token.borderRadiusLG}px;
          box-shadow: 0 0 0 2px ${token.colorPrimary};
        }
      `}</style>
      <Tour
        actionsRender={() => (
          <Space wrap size="small">
            {canGoBack ? (
              <Button size="small" onClick={() => setCurrent(current - 1)}>
                {t("tour.prev")}
              </Button>
            ) : null}
            {canGoForward ? (
              <Button size="small" type="primary" onClick={goForward}>
                {forwardLabel()}
              </Button>
            ) : (
              <Typography.Text type="secondary">{t("tour.waiting")}</Typography.Text>
            )}
          </Space>
        )}
        current={current}
        gap={{ offset: 6, radius: 8 }}
        indicatorsRender={(index, total) => (
          <Typography.Text type="secondary">{t("tour.progress", { current: index + 1, total })}</Typography.Text>
        )}
        open={visible}
        scrollIntoViewOptions={{ block: "center", inline: "nearest", behavior: token.motion ? "smooth" : "auto" }}
        steps={steps.map((candidate, index) => ({
          title: index === current ? title : "",
          description: index === current ? description : "",
          mask: candidate.mask,
          placement: candidate.placement,
          // antd 把返回值类型拆成「返回元素」和「返回 null」两种函数，运行时两种结果都接受。
          target: (() => findGuideTarget(candidate.target)) as () => HTMLElement,
        }))}
        // 键盘左右键也走这里：需要操作的步骤不能被方向键跳过。
        onChange={index => {
          if (index === current - 1 && canGoBack) {
            setCurrent(index);
          } else if (index === current + 1 && canGoForward) {
            goForward();
          }
        }}
        onClose={() => exit("closed")}
      />
      <div style={visuallyHidden} aria-live="polite">
        {visible ? t("tour.announce", { title, description }) : ""}
      </div>
    </>
  );
}
