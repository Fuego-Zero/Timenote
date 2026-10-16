const icons = [
  { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** 安装清单随语言变化。query lang 优先，否则看 Accept-Language 的第一项。 */
export function manifestForLanguage(language: string | null | undefined) {
  const primary = language?.split(",")[0]?.trim().toLowerCase() ?? "";
  const chinese = primary.startsWith("zh");
  return {
    name: chinese ? "岁时记" : "Timenote",
    short_name: chinese ? "岁时记" : "Timenote",
    description: chinese
      ? "维护生日、纪念日和跨天事件，用私密 ICS 地址订阅到任意支持订阅的日历（苹果日历、Google 日历、Outlook 等）。"
      : "Keep birthdays, anniversaries, and multi-day events, and subscribe to them with a private ICS URL.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#d6246e",
    icons,
  };
}

export function manifestLanguage(url: string, acceptLanguage: string | string[] | undefined) {
  const query = new URL(url, "http://127.0.0.1").searchParams.get("lang");
  if (query) {
    return query;
  }

  return Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
}
