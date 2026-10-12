/** 生产环境首个管理员密码（环境变量种子 / 引导创建）的可测试规则。 */
const weakAdminPasswords = new Set([
  "password",
  "passwordpassword",
  "password12345678",
  "admin",
  "admin12345678901",
  "change-me-to-a-long-random-password",
  "1234567890123456",
  "qwertyuiopasdfgh",
  "aaaaaaaaaaaaaaaa",
]);

/** 至少 16 位、最多 128 位，且至少覆盖三类字符（小写/大写/数字/符号），并避开常见弱口令。 */
export function isStrongAdminPassword(password: string) {
  if (password.length < 16 || password.length > 128) {
    return false;
  }

  if (weakAdminPasswords.has(password.toLowerCase())) {
    return false;
  }

  let classes = 0;
  if (/[a-z]/.test(password)) {
    classes += 1;
  }

  if (/[A-Z]/.test(password)) {
    classes += 1;
  }

  if (/[0-9]/.test(password)) {
    classes += 1;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    classes += 1;
  }

  return classes >= 3;
}

export function strongAdminPasswordMessage() {
  return "生产环境管理员密码至少 16 位，且需包含小写/大写/数字/符号中至少三类，并避免常见弱口令";
}
