/** 运行环境支持的 IANA 时区列表，供下拉选择；常用时区排在前面。 */
const common = ["Asia/Shanghai", "Asia/Hong_Kong", "Asia/Taipei", "Asia/Tokyo", "America/New_York", "Europe/London"];

export function timeZoneOptions() {
  const all = Intl.supportedValuesOf("timeZone");
  return [...common.filter(zone => all.includes(zone)), ...all.filter(zone => !common.includes(zone))].map(zone => ({
    label: zone,
    value: zone,
  }));
}
