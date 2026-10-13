/** 从 apps/web/public/favicon.svg 生成 favicon.ico、各尺寸 PNG 与 maskable 图标：pnpm icons。 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// eslint-disable-next-line import-x/no-extraneous-dependencies -- 仅构建期手动运行，按方案只进 devDependencies。
import { Resvg } from "@resvg/resvg-js";
// eslint-disable-next-line import-x/no-extraneous-dependencies -- 仅构建期手动运行，按方案只进 devDependencies。
import pngToIco from "png-to-ico";

const publicDir = join(import.meta.dirname, "../apps/web/public");
const source = readFileSync(join(publicDir, "favicon.svg"), "utf8");

function renderPng(svg: string, size: number) {
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
}

/** maskable：背景铺满整张画布，原图标缩到 80% 安全区内居中。 */
function maskableSvg(svg: string) {
  const inner = svg
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<defs>[\s\S]*?<\/defs>/, "");
  const background = /<linearGradient[\s\S]*?<\/linearGradient>/.exec(svg)?.[0] ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${background}</defs><rect width="512" height="512" fill="url(#bg)"/><g transform="translate(51.2 51.2) scale(0.8)">${inner}</g></svg>`;
}

const outputs: [string, number][] = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
];
for (const [name, size] of outputs) {
  writeFileSync(join(publicDir, name), renderPng(source, size));
}

writeFileSync(join(publicDir, "maskable-512x512.png"), renderPng(maskableSvg(source), 512));
writeFileSync(join(publicDir, "favicon.ico"), await pngToIco([16, 32, 48].map(size => renderPng(source, size))));
