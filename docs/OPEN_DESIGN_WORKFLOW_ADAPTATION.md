# OPEN_DESIGN_WORKFLOW_ADAPTATION.md — Open Design 工作流的本地化

本 skill **借鉴 Open Design 的工作流思想**，但只保留与"基于两套 PKU PPT 模板生成/校验/返修/导出学术汇报"相关的部分。

## 思想映射
| Open Design 阶段 | 本 skill 对应 | 落地物 |
| --- | --- | --- |
| brief | PPT 大纲（Markdown） | `source_outline.md` |
| skill / template | 选 PKU 模板（left/top） | `--template` / 自动选择 |
| direction / brand lock | 锁定 PKU 红学术方向 | `design/PKU_DESIGN.md` |
| design system | **本项目专用**设计契约（非 150 个 DESIGN.md） | `design/PKU_DESIGN.md` |
| craft references | **本项目专用** craft（非全平台 craft） | `references/typography·layout·image-rules·anti-ai-slop·revision-rules.md` |
| artifact | HTML PPT（非网页/App/视频/海报） | `index.html` + `deckConfig.json` + `slides.json` |
| preview | 浏览器直接打开 | `index.html`（缩放/翻页/打印） |
| critique | 自我批判（只发现不修改） | `critique_deck.js` → `critique_report.json` |
| auto-repair | 自动修复布局 | `auto_repair.js` → `repair_report.json` |
| revision (局部返修) | 内容/排版局部返修 | `apply_revision.js` + `revision_engine.js` |
| handoff | 交付可编辑/可导出/可版本化文件 | `output/` + `output.pdf` + `README_export.md` |
| memory | 沉淀成功产物与经验 | `deckConfig.json` 复用 + skill 记忆 + `template_manifest.json` |

## 流程
```
PPT 大纲 brief
→ 选择 PKU 模板
→ 锁定 PKU 红色学术方向（读 PKU_DESIGN.md 与排版规则）
→ 生成 HTML PPT artifact
→ 自动校验 / 自我批判
→ 自动修复布局问题
→ 导出 HTML / PDF / deckConfig
→ 记录返修历史与可复用经验
```

## 明确不引入（范围红线）
- ❌ Open Design GUI ❌ MCP server ❌ 插件市场 ❌ 150 个 DESIGN.md 系统
- ❌ 网页原型 / App 原型 / 视频 / 海报 / 图片生成
- ❌ 泛化设计平台 ❌ 与这两套 PKU 模板无关的模板 ❌ 改变 PKU 红学术风格

`tests/run_tests.js` 的 `workflow` 用例会校验：各阶段产出对应文件、仓库中没有 MCP/GUI/market 目录、`templates/` 恰为两套模板。

## artifact 集合（仅这些）
`index.html` · `deckConfig.json` · `slides.json` · `output.pdf` · `layout_report.json` · `critique_report.json` · `revision_history.json` · `revision_report.json` · `README_export.md`。
