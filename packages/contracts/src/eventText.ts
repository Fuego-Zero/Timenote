import { z } from "zod";

/** 除多行字段允许的换行外，拒绝所有 C0 控制字符和 DEL，防止注入 ICS 属性或干扰显示。 */
export function hasForbiddenControl(value: string, multiline: boolean) {
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if ((code < 0x20 || code === 0x7f) && !(multiline && char === "\n")) {
      return true;
    }
  }

  return false;
}

export function plainText(max: number, options: { multiline: boolean }) {
  return z
    .string()
    .max(max)
    .refine(value => !hasForbiddenControl(value, options.multiline), "包含不允许的控制字符");
}
