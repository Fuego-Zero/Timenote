import { Tag, theme } from "antd";
import type { CSSProperties, ReactNode } from "react";

export type EventTagTone =
  "anniversary" | "birthday" | "custom" | "duration" | "general" | "holiday" | "lunar" | "reminder" | "solar";

/** 事件相关 Tag 的唯一入口：字色与底色只取主题 token，组件内不写颜色值。 */
export function EventTag({
  tone,
  children,
  style,
}: {
  tone: EventTagTone;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { token } = theme.useToken();
  const colors: Record<EventTagTone, { color: string; backgroundColor: string }> = {
    birthday: { color: token.tagBirthdayColor, backgroundColor: token.tagBirthdayBg },
    anniversary: { color: token.tagAnniversaryColor, backgroundColor: token.tagAnniversaryBg },
    holiday: { color: token.tagHolidayColor, backgroundColor: token.tagHolidayBg },
    custom: { color: token.tagCustomColor, backgroundColor: token.tagCustomBg },
    general: { color: token.tagGeneralColor, backgroundColor: token.tagGeneralBg },
    solar: { color: token.tagSolarColor, backgroundColor: token.tagSolarBg },
    lunar: { color: token.tagLunarColor, backgroundColor: token.tagLunarBg },
    duration: { color: token.tagDurationColor, backgroundColor: token.tagDurationBg },
    reminder: { color: token.tagReminderColor, backgroundColor: token.tagReminderBg },
  };
  // 调用方 style 先展开，token 颜色写在后面，保证字色与底色不被覆盖。
  return (
    <Tag styles={{ root: { ...style, ...colors[tone] } }} variant="filled">
      {children}
    </Tag>
  );
}
