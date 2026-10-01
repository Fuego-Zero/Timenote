# 仓库指令入口

本文件保存 Cursor 和 Codex 共用的项目工程原则，详细工程规则维护在 `.cursor/rules/`。

## Engineering principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.

## 注释与提交语言

代码注释和 Git 提交消息中的自然语言说明必须全部使用中文。提交消息必须遵守约定式提交规范（Conventional Commits），例如 `fix(calendar): 修复农历闰月周年计算错误`。类型标记、代码标识符及工具规定的关键字保留标准写法，详细规则见 `.cursor/rules/03-language-and-commits.mdc`。

## 读取规则

- 开始仓库任务时，检查 `.cursor/rules/` 中的 `.mdc` 文件，读取所有 `alwaysApply: true` 的规则正文。
- 按任务涉及的文件、技术和职责，读取其他适用规则。除 `globs` 外，也参考 `description`：例如 Node 服务规则同样适用于 `apps/api/` 和 `apps/web/server/` 中的服务代码。
- `.mdc` 的 YAML frontmatter 是规则元数据，正文是执行指令。`alwaysApply: false` 表示按适用范围读取，并不表示规则无效。
- 用户在当前任务中的明确要求优先于仓库规则。本文件的工程原则适用于代码、规则和文档，优先于 `.cursor/rules/`、`README.md` 和 `docs/` 中与之冲突的开发指导；命名问题以 `.cursor/rules/05-naming-conventions.mdc` 为准，其他不冲突的工程规则继续有效。
- 规则中的相对路径以仓库根目录为基准。规范之间如有影响当前任务的实际冲突，先说明冲突，不自行扩大改造范围。

## 文档使用

- `README.md` 负责启动与使用，`docs/` 中的正式文档负责现行产品要求、架构、配置、安全和部署说明；按任务需要读取。
- 文档中的实现现状用于定位代码，不构成保留过时路径或增加兼容层的理由。实现变化时同步更新文档，不能只修改文字就声称代码已经完成改造。
- 正式文档不记录一次性任务进度、历史验收结果、账号资源余额或未经当前需求确认的未来计划。
- 项目内所有临时文件统一存放在根目录 `.tmp/`，包括计划、截图、测试报告、调试脚本、日志和测试临时数据；按用途使用子目录，整个目录由 Git 忽略。
- `.tmp/` 中的计划、截图、报告和历史快照只作背景证据，不作为当前执行指令、长期规范或生产运行前提；生产代码、正式文档和仓库规则不得依赖其中的文件。
