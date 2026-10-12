/**
 * timenote 主题色板（单源）。
 * 与 apps/web/public/favicon.svg 对齐：主色 #d4380d、环钉 #873800。
 * CSS 变量见 style.css :root；antd ConfigProvider 从本文件取值。
 * 渐变起止色：当前 favicon 为纯色，渐变默认取 volcano 阶，待图标源核对。
 */
export const themeTokens = {
  /** 主色：图标日历顶栏 / 心形 */
  colorPrimary: "#d4380d",
  /** 悬停：略亮珊瑚 */
  colorPrimaryHover: "#f15a29",
  /** 按下 / 激活：更深朱红 */
  colorPrimaryActive: "#ad2102",
  /** 链接：略深于主色，正文可读 */
  colorLink: "#c0360c",
  /** 链接悬停 */
  colorLinkHover: "#d4380d",
  /** 主色浅底：选中态 / soft bg / 高亮区 */
  colorPrimarySoft: "#fff2ee",
  /** Segmented / Tab / Menu 选中底 */
  colorSelectedBg: "#fff2ee",
  /** Segmented / Tab / Menu 选中字 */
  colorSelectedText: "#d4380d",
  /** 按钮 primary 高亮描边（antd colorPrimaryBorder） */
  colorPrimaryBorder: "#ff9c6e",
  /** 渐变起（浅珊瑚）— 待图标源核对 */
  colorGradientStart: "#ff7a45",
  /** 渐变止（与主色同）— 待图标源核对 */
  colorGradientEnd: "#d4380d",
  /** 图标环钉 / 深强调 */
  colorAccentDark: "#873800",
  /** 页面底 */
  colorSurface: "#faf7f5",
  /** 暖边框 */
  colorBorderWarm: "#f0e6e0",
} as const;

export type ThemeTokens = typeof themeTokens;
