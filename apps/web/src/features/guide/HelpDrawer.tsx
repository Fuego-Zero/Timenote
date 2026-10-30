import { Button, Collapse, Divider, Drawer, Flex, Grid, theme, Typography } from "antd";
import { type ReactNode, useRef } from "react";
import { useTranslation } from "react-i18next";

import { defaultLocaleCode, resolveLocale } from "../../i18n/index.js";
import type { HelpSection } from "./guideContext.js";
import { useGuide } from "./useGuide.js";

/** 界面截图由 `pnpm media:guide` 生成，按语言放在 media/<语言>/ 下；缺少某语言时用默认语言。 */
const screenshots = import.meta.glob<string>("./media/*/*.png", { eager: true, import: "default" });

function screenshot(code: string, name: "editor" | "feeds") {
  return screenshots[`./media/${code}/${name}.png`] ?? screenshots[`./media/${defaultLocaleCode}/${name}.png`];
}

interface CalendarClient {
  steps: string[];
  title: string;
  url: string;
}

interface FaqItem {
  a: string;
  q: string;
}

/**
 * 抽屉里缩小显示，点开在新标签页看原图。不用 antd Image：它的预览层挂在抽屉里会占用 Esc，抽屉就关不掉了。
 */
function Screenshot({ alt, src }: { alt: string; src: string | undefined }) {
  const { token } = theme.useToken();
  return (
    <Typography.Paragraph>
      <a href={src} rel="noopener noreferrer" target="_blank">
        <img
          alt={alt}
          loading="lazy"
          src={src}
          style={{
            display: "block",
            width: "100%",
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
          }}
        />
      </a>
    </Typography.Paragraph>
  );
}

function headingId(id: HelpSection) {
  return `help-${id}`;
}

function Section({ id, title, children }: { id: HelpSection; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={headingId(id)}>
      <Typography.Title id={headingId(id)} level={5} style={{ marginTop: 0 }}>
        {title}
      </Typography.Title>
      {children}
    </section>
  );
}

/** 帮助抽屉：产品说明、重新开始引导、各日历客户端的添加步骤与常见问题。按需加载，不影响首屏。 */
export function HelpDrawer({
  open,
  section,
  onClose,
  onClosed,
}: {
  open: boolean;
  section?: HelpSection;
  onClose: () => void;
  /** 关闭动画结束后调用，用于此时再开始引导，避免遮罩叠在抽屉上。 */
  onClosed: () => void;
}) {
  const { t, i18n } = useTranslation("guide");
  const guide = useGuide();
  const screens = Grid.useBreakpoint();
  const { code } = resolveLocale(i18n.language);
  const firstTourButton = useRef<HTMLButtonElement>(null);
  const introSteps = t("help.intro.steps", { returnObjects: true }) as string[];
  const clients = t("help.calendar.clients", { returnObjects: true }) as CalendarClient[];
  const faq = t("help.faq.items", { returnObjects: true }) as FaqItem[];

  return (
    <Drawer
      afterOpenChange={visible => {
        if (!visible) {
          onClosed();
        } else if (section) {
          document.getElementById(headingId(section))?.scrollIntoView({ block: "start" });
        }
      }}
      open={open}
      size={screens.md ? 560 : "100%"}
      title={t("help.title")}
      onClose={onClose}
    >
      <Section id="intro" title={t("help.intro.title")}>
        <Typography.Paragraph>{t("help.intro.body")}</Typography.Paragraph>
        <Typography>
          <ol>
            {introSteps.map(text => (
              <li key={text}>{text}</li>
            ))}
          </ol>
        </Typography>
        <Screenshot alt={t("help.intro.editorAlt")} src={screenshot(code, "editor")} />
      </Section>
      <Divider />
      <Section id="tours" title={t("help.tours.title")}>
        <Typography.Paragraph type="secondary">{t("help.tours.body")}</Typography.Paragraph>
        <Flex wrap gap="small">
          <Button ref={firstTourButton} onClick={() => guide.startTour("event")}>
            {t("help.tours.event")}
          </Button>
          <Button onClick={() => guide.startTour("feed")}>{t("help.tours.feed")}</Button>
          {!guide.checklistVisible && (
            <Button
              type="link"
              onClick={() => {
                guide.showChecklist();
                // 按钮随即消失，焦点留在抽屉里，Esc 仍可关闭、读屏不会跳回页首。
                firstTourButton.current?.focus();
              }}
            >
              {t("help.tours.showChecklist")}
            </Button>
          )}
        </Flex>
      </Section>
      <Divider />
      <Section id="calendar" title={t("help.calendar.title")}>
        <Typography.Paragraph type="secondary">{t("help.calendar.body")}</Typography.Paragraph>
        <Screenshot alt={t("help.calendar.screenshotAlt")} src={screenshot(code, "feeds")} />
        <Collapse
          defaultActiveKey={section === "calendar" ? clients.map(client => client.title) : undefined}
          items={clients.map(client => ({
            key: client.title,
            label: client.title,
            children: (
              <Typography>
                <ol style={{ marginTop: 0 }}>
                  {client.steps.map(text => (
                    <li key={text}>{text}</li>
                  ))}
                </ol>
                <Typography.Link href={client.url} rel="noopener noreferrer" target="_blank">
                  {t("help.calendar.official")}
                </Typography.Link>
              </Typography>
            ),
          }))}
        />
      </Section>
      <Divider />
      <Section id="faq" title={t("help.faq.title")}>
        <Collapse
          items={faq.map(item => ({
            key: item.q,
            label: item.q,
            children: <Typography.Paragraph style={{ marginBottom: 0 }}>{item.a}</Typography.Paragraph>,
          }))}
        />
      </Section>
    </Drawer>
  );
}
