/** 纯日期 `YYYY-MM-DD`；内部用 UTC 零点做加减，避免本地时区让日期前移或后移。 */
export type IsoDate = string;

const dayMs = 24 * 60 * 60 * 1000;

export function isGregorianLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInGregorianMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(value: IsoDate) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function utcMs(value: IsoDate) {
  const { year, month, day } = parseIsoDate(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC 会把 0-99 年映射到 1900 年代，必须显式还原。
  date.setUTCFullYear(year);
  return date.getTime();
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = new Date(utcMs(value) + days * dayMs);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** 两个纯日期相差的天数（end - start）。 */
export function daysBetween(start: IsoDate, end: IsoDate) {
  return Math.round((utcMs(end) - utcMs(start)) / dayMs);
}

/** 固定宽度的 `YYYY-MM-DD` 可以直接按字符串比较先后。 */
export function compareIsoDate(left: IsoDate, right: IsoDate) {
  return left.localeCompare(right, "en");
}
