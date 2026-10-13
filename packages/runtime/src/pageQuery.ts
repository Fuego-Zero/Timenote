/** LIKE 关键字转义：\ → \\、% → \%、_ → \_，配合 ESCAPE '\' 做字面子串匹配。 */
export function containsPattern(q: string) {
  return `%${q.replace(/[\\%_]/g, match => `\\${match}`)}%`;
}

export function pageOffset(page: number, pageSize: number) {
  return (page - 1) * pageSize;
}
