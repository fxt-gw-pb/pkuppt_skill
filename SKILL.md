---
name: ppt-pku
description: >-
  Generate, validate, auto-repair, revise and export PKU-red (北京大学红) academic
  HTML presentation decks from a Markdown outline, images, tables and revision
  requests, using the two bundled PKU templates (left-sidebar 1920×1080 / top-nav
  1280×720). Produces a self-contained index.html plus deckConfig.json, PDF, and
  layout/critique reports; never overflows/overlaps; follows the outline exactly;
  supports surgical local revisions. Use when the user asks for a 北大红 / PKU /
  学术汇报 / 论文答辩 / HTML PPT, mentions "ppt_pku" or "ppt-pku", or wants to
  revise (放大图/拆页/改章节名/换图/删页/只修排版) a PKU deck this skill made.
  Run scripts with Node (zero npm deps); PDF export uses headless Chrome.
---

> Skill name is `ppt-pku` (Claude Code skill names must be hyphenated); the project / repo is `ppt_pku`. Invoke with `/ppt-pku` or just describe the task. Run all scripts from this skill's directory.

# ppt_pku — PKU 红色学术汇报 HTML PPT

把 PPT 大纲 / 文稿 / 图片 / 表格 / 返修意见，变成一份完整、美观、**不溢出、不重叠、完全遵循大纲**的北京大学红色学术汇报 HTML PPT；可浏览器预览、导出 PDF、版本管理与**局部返修**。仅服务于两套既有 PKU 模板（`left-sidebar` / `top-nav`），不做泛化设计平台。

零依赖：所有脚本均为纯 Node.js（无需 `npm install`）。

## 1. When to use this skill
- 用户要做"北大红 / PKU 学术汇报 / 论文答辩 PPT"，并提供大纲或文稿。
- 用户已有本 skill 生成的 PPT，提出**返修**意见（放大图、拆页、改章节名、换图、删页、只修排版等）。
- 用户要把大纲导出为可预览的 HTML、PDF 或可继续编辑的中间文件。

不要用于：通用网页/App/海报/视频/图片生成；非 PKU 风格的模板；引入 GUI / MCP / 插件市场。

## 2. Inputs expected
- **PPT 大纲（Markdown）**：见 `docs/OUTLINE_FORMAT.md`。`##`=一级章节（导航/目录/Part），`###`=页面，段落=正文，`-`=要点，`![](...)`+`caption:`=图与图注，`| |`=表格，`**加粗**`=重点。
- **图片文件**：放在大纲可引用到的相对/绝对路径。
- **表格 / 数据**：Markdown 表格。
- **模板选择（可选）**：front matter `template: left-sidebar | top-nav`；缺省按章节数自动选。
- **返修意见**：自然语言 Markdown 或结构化 YAML，见 `docs/REVISION_WORKFLOW.md`。

## 3. Open-Design-style workflow, adapted for PKU PPT
```
PPT 大纲 brief
→ 选择 PKU 模板 (left-sidebar / top-nav)
→ 锁定 PKU 红色学术方向 (design/PKU_DESIGN.md + references/*)
→ 生成 HTML PPT artifact (index.html + deckConfig.json + slides.json)
→ 自动校验 / 自我批判 (layout_report.json + critique_report.json)
→ 自动修复布局问题 (auto_repair)
→ 导出 (output.pdf) 与交付 (README_export.md)
→ 记录返修历史与可复用经验 (revision_history.json + 模板记忆)
```
吸收的 Open Design 思想：brief→template→design contract→artifact→critique→handoff→memory、artifact-first 预览、自我批判、局部返修。**明确不引入**：GUI、MCP server、插件市场、150 个 DESIGN.md、网页/App/视频/海报能力、任何与这两套模板无关的内容。详见 `docs/OPEN_DESIGN_WORKFLOW_ADAPTATION.md`。

## 4. Workflow — first-time deck generation
1. 读大纲；不擅自重排/删减/改写核心内容。
2. 定模板：用户指定优先；否则 `sections >= 5 → top-nav`，否则 `left-sidebar`。
3. 生成：
   ```bash
   node scripts/build_deck.js <大纲.md> --out output [--template left-sidebar|top-nav]
   ```
   产出 `output/index.html`、`deckConfig.json`、`slides.json`、`source_outline.md`，并把图片复制进 `output/assets/`。
4. 校验 + 自我批判：
   ```bash
   node scripts/validate_layout.js output
   node scripts/critique_deck.js output
   ```
5. 自动修复（如有问题）：`node scripts/auto_repair.js output`
6. 导出 + 打包：`node scripts/export_pdf.js output` && `node scripts/package_output.js output`
7. 在浏览器打开 `output/index.html` 预览（← → 翻页，⎙ 导出 PDF）。

## 5. Workflow — critique & auto-repair
- `critique_deck.js` **只发现问题不改内容**：风格漂移（渐变/阴影/3D/emoji/过度圆角）、未渲染加粗、缺标题、孤儿章节、图注缺失，并并入 `validate_layout.js` 的溢出/重叠/字号/图过小/表过密/导航溢出/页码连续性。输出 `critique_report.json`（含 `overall_score` 与 `recommended_repairs`）。
- `auto_repair.js` 按"先布局后字号、不低于最小字号、必要时拆页、不改文案、不改章节顺序、不引入新风格"的原则修复，修复后**重新校验并重跑 critique**，迭代至通过或达上限。输出 `repair_report.json`。

## 6. Workflow — content revision / refinement
```bash
node scripts/apply_revision.js output 返修意见.md          # 文件（NL 或 YAML）
node scripts/apply_revision.js output --text "第5页图片放大；所有加粗用北大红"
```
- 精准定位：页码（第 N 页 / slide N）、章节（章节名 / sectionId）、图片（图 N / 图注关键字）。
- 局部修改、不误删、保持章节顺序；若返修导致溢出/重叠则自动修复。
- 返修后**重新生成 HTML、重新校验、重跑 critique、重导出 PDF**，并写 `revision_history.json` + `revision_report.json` + 修改摘要。

## 7. Template selection
- `left-sidebar`：1920×1080，左侧红色竖栏导航，章节少（3–4）更合适。
- `top-nav`：1280×720，上方横向导航 + Part 过渡页，章节多（≥5）更合适。
- 用户明确指定 → 必须服从。导航/目录/Part **完全由 `deck.sections` 自动生成**，绝不写死 4 项或 5 项。详见 `docs/TEMPLATE_SWITCHING.md`。

## 8. Outline parsing rules
见 `docs/OUTLINE_FORMAT.md`。要点：front matter 全局配置；`##`→章节（`english:` 设英文标题，用于 Part 页）；`###`→页面；段落→正文；`-`→要点；`**x**`→重点（渲染为 `.emphasis`）；`![alt](src)` + `caption:`→图与图注（绑定）；Markdown 表格→表格；单页过满**自动拆为连续多页**并加"（续）"。

## 9. Layout rules
见 `references/layout.md` 与 `docs/LAYOUT_RULES.md`。固定安全区 + 内部流式排布（flex/grid），流式内容天然不重叠，`object-fit:contain` 天然不变形；校验只需确认流式高度不超过安全区。布局类型：`text-only / image-full / text-image-right / image-text-right / text-image-bottom / three-points / four-cards / timeline / table / comparison / image-grid(-2)`。

## 10. Image insertion rules
见 `references/image-rules.md` 与 `docs/IMAGE_RULES.md`。保持宽高比；默认 `contain`；装饰底图才 `cover`；图必入容器、在安全区内、不遮标题/导航/页码/图注/正文；按宽/竖/方/截图/统计图选布局；图注绑定且字号清晰；图多自动拆页；图大不挤压正文（改大图页或拆页）。

## 11. Bold emphasis rules
`**加粗**` → `<strong class="emphasis">`，字重 700，默认北大红；可经返修切换 `pku-red | dark | plain`。不用荧光色/阴影/过度装饰。

## 12. Validation, auto-repair, export
- 校验：`validate_layout.js` 几何确定性模型（无需浏览器；Playwright 仅为可选增强）。
- 修复：`auto_repair.js`（见 §5）。
- 导出：`export_pdf.js` 用本机无头 Chrome/Edge 经 DevTools 协议按 16:9 导出（自动探测；找不到则提示手动打印）。

## 13. Handoff outputs
`output/`：`index.html`、`assets/`、`source_outline.md`、`deckConfig.json`、`slides.json`、`output.pdf`、`layout_report.json`、`critique_report.json`、`revision_history.json`、`revision_report.json`、`README_export.md`。

## 14. Memory / reusable lessons
- 成功大纲 + 其 `deckConfig.json` 可作为后续同类汇报的起点。
- 反复出现的返修（如统一加粗为北大红、某类图固定用大图页）应沉淀为默认；新模板细节记入 `template_manifest.json` 与本 SKILL.md。
- 经验性结论写入 skill 记忆（见 README「记忆」一节），不要把可由代码/历史得知的内容重复记录。

## 15. Final output checklist
- [ ] 完全遵循大纲（不重排/删减/改写）；超长自动拆页并保序。
- [ ] 导航/目录/Part 来自 sections，数量正确，当前页高亮。
- [ ] 图片不变形/不溢出/不遮挡，图注绑定清晰；多图合理或拆页。
- [ ] 字体大方可读，正文 ≥ 模板下限，加粗重点醒目。
- [ ] `validate_layout` 无高危问题；`critique` 无风格漂移。
- [ ] HTML 可浏览器直接打开；PDF 16:9 正常导出。
- [ ] 返修为局部修改、不误删、页码/导航正确，并写入返修记录与摘要。
