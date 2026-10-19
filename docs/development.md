# 开发说明

本地启动、端口和生产构建见 [README](../README.zh-CN.md#自己部署)；结构与数据流见[架构说明](architecture.md)。

## 质量检查

```sh
pnpm check        # typecheck、lint、format:check、Vitest、build
pnpm test:e2e     # Playwright（本机 Microsoft Edge），自动以临时 SQLite 启动 pnpm dev
pnpm verify       # 以上全部，并在 .tmp/verification-results/latest 保存源码哈希、退出码、日志与测试 JSON
```

- 端到端测试用独立端口 4183 / 4184 和 `.tmp/e2e/` 下的新 SQLite，不读写 `.env` 配置的数据库；失败截图和报告写在 `.tmp/test-results/`、`.tmp/playwright-report/`。
- 接口请求带会话签名，测试里的账号和数据通过界面创建，不直接调用 `/api`。
- 新用户引导的端到端测试在 `tests/e2e/onboarding.spec.ts`：跳过与重新打开、两段引导走完并真实拉取一次 ICS、中途暂停与继续、帮助入口、手机宽度与减少动态效果。

自动化测试覆盖规则引擎、ICS 往返解析、接口权限边界、日志脱敏与端到端流程，但不能替代真机验收：各日历客户端的刷新周期、提醒弹出和显示效果需按[订阅验收清单](subscription-acceptance.md)手工确认。

## 引导与演示素材

README 和帮助抽屉里的截图、演示视频由 `pnpm media:guide` 从真实界面录制，生成方式和隔离说明见[引导与演示素材](guide-media.md)。界面或文案改动影响这些画面时，重新生成并逐张核对后再提交。

## AI 工程

规则在 `.cursor/rules/`，总览见 `AGENTS.md`。Cursor 使用 `.cursor/hooks.json`；Codex 使用 `.codex/hooks.json`，两者共用 `.cursor/hooks/afterAgent.mjs`，在每轮结束时用 Prettier 格式化本轮修改的文件。Codex 首次使用或修改 hook 定义后，需要在 CLI 的 `/hooks` 中审阅并信任。
