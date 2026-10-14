/** antd Form.Item 的错误展示属性；errors 的键是契约字段路径（如 `date.day`）。 */
export function fieldStatus(errors: Record<string, string>, ...paths: string[]) {
  const message = paths.map(path => errors[path]).find(Boolean);
  return message ? { validateStatus: "error" as const, help: message } : {};
}
