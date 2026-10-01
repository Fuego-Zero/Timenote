import { existsSync } from "node:fs";

if (!existsSync("apps/web/dist/index.html")) {
  throw new Error("缺少 Web 静态构建；先执行 pnpm build");
}

if (!process.argv.includes("--built")) {
  process.argv.push("--built");
}

await import("./dev.js");
