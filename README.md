# ppt_pku — PKU 红色学术汇报 HTML PPT skill

把 **PPT 大纲 / 文稿 / 图片 / 表格 / 返修意见** 变成一份完整、美观、**不溢出、不重叠、完全遵循大纲** 的北京大学红色学术汇报 HTML PPT；可浏览器预览、导出 PDF、版本管理与 **局部返修**。

> 零依赖：所有脚本均为纯 Node.js（Node ≥ 18，建议 ≥ 20），**无需 `npm install`**。PDF 导出会自动调用本机已安装的 Chrome / Edge。

## 安装

### 导入 Codex（其他用户）
Codex 没有原生 SKILL.md 机制，用其自定义提示词（slash command）接入——两条命令即可：
```bash
# 1) 克隆为 Codex 技能
git clone https://github.com/fxt-gw-pb/pkuppt_skill.git ~/.codex/skills/ppt_pku
# 2) 注册 /ppt_pku 斜杠命令
mkdir -p ~/.codex/prompts && cp ~/.codex/skills/ppt_pku/install/codex/ppt_pku.md ~/.codex/prompts/ppt_pku.md
```
随后在 Codex 里输入 **`/ppt_pku 你的需求`** 即可（也可直接说"做个北大红/PKU 学术汇报 PPT"）。
（可选）让 Codex 在不打斜杠时也识别本技能：`cat ~/.codex/skills/ppt_pku/install/codex/AGENTS.snippet.md >> ~/.codex/AGENTS.md`

### 导入 Claude Code（其他用户）
Claude Code 的 skill 名用连字符，本仓库 `SKILL.md` 已设为 `ppt-pku`，克隆即用：
```bash
git clone https://github.com/fxt-gw-pb/pkuppt_skill.git ~/.claude/skills/ppt-pku
# 重启 Claude Code 后用 /ppt-pku 调用（或直接描述"做个北大红 PPT"自动触发）
```

## 1. 这是什么
一个专用 Claude/Agent skill：基于两套既有 PKU 红色 HTML PPT 模板，自动 **生成 / 校验 / 返修 / 导出** 学术汇报 PPT。它不是设计平台，只服务这一件事。

## 2. 如何借鉴 Open Design 工作流
吸收其 `brief → template → design contract → artifact → critique → handoff → memory` 思想与 artifact-first 预览、自我批判、局部返修。详见 `docs/OPEN_DESIGN_WORKFLOW_ADAPTATION.md`。

## 3. 与 Open Design 的区别
**只服务于两套 PKU PPT 模板**。不引入 GUI、MCP server、插件市场、150 个 DESIGN.md、网页/App/视频/海报/图片生成，不做泛化设计平台，不改变 PKU 红学术风格。

## 4. 适合什么场景
论文答辩、开题/中期、课题汇报、组会、项目结题等需要"北大红学术 PPT"的场合。

## 5–8. 准备大纲 / 放图 / 选模板 / 运行生成
- **大纲**：Markdown，见 `docs/OUTLINE_FORMAT.md`。`##`=章节，`###`=页面，`**加粗**`=重点，`![](path)`+`caption:`=图与图注，`| |`=表格。
- **放图**：放在大纲能引用到的相对/绝对路径；生成时自动复制进 `output/assets/`。
- **选模板**：front matter `template: left-sidebar | top-nav`；缺省按章节数自动选（≥5 用 top-nav）。
- **生成**：
  ```bash
  node scripts/build_deck.js examples/example_outline_top_nav.md --out output
  ```

## 9. 导出 PDF
```bash
node scripts/export_pdf.js output            # 自动探测 Chrome/Edge，按 16:9 导出 output/output.pdf
```
找不到浏览器时会提示：打开 `output/index.html` 用 Ctrl/Cmd-P 另存为 PDF（16:9、无边距、勾选背景图形）。

## 10–11. 查看 layout / critique 报告
```bash
node scripts/validate_layout.js output       # -> output/layout_report.json（溢出/重叠/字号/图/表/导航/页码）
node scripts/critique_deck.js  output        # -> output/critique_report.json（风格漂移/AI slop/结构/可读性 + 评分）
node scripts/auto_repair.js    output        # 读上面两份报告并自动修复，修复后重校验
```

## 12–13. 提交返修 / 查看返修记录
```bash
node scripts/apply_revision.js output 返修意见.md
node scripts/apply_revision.js output --text "第5页图片放大；所有加粗用北大红"
cat output/revision_report.json              # 本次返修详情
cat output/revision_history.json             # 全部返修历史（每次追加）
```
返修为局部修改，完成后自动重校验、重 critique、重生成 HTML（默认重导 PDF）。详见 `docs/REVISION_WORKFLOW.md`。

## 14. 新增或微调模板
每套模板在 `templates/<id>/`：`theme.css`（外观）+`renderer.js`（套版）+`template_manifest.json`（几何/字号契约）+`assets/`+`index.html`（可手改的独立演示稿）。几何/字号下限集中在 `scripts/lib/theme.js`。微调外观改 `theme.css`；改安全区/字号改 `theme.js`（渲染、校验、修复会同步）。**保持 PKU 红学术风格**，遵守 `references/anti-ai-slop.md`。

## 15. 常见问题
- **图太多**：自动按 上限（有文 2 / 无文 4）拆为多页网格。
- **文字太多**：自动拆为连续多页（"（续）"），不无限缩字。
- **导航章节太多**：导航/目录字号间距自动缩小，不溢出。
- **保留加粗**：大纲写 `**重点**` 即可；返修可统一为北大红/深色。
- **插入表格**：写 Markdown 表格；过大自动分页不丢行。
- **返修某一页 / 只修排版 / 替换某图**：见 §12 与 `docs/REVISION_WORKFLOW.md`（`split_text` / `reflow` / `replace_image`）。
- **避免偏离 PKU 风格**：`critique_deck.js` 会报 `template_drift`，按 `design/PKU_DESIGN.md` 与 `references/anti-ai-slop.md` 撤销装饰。

## 目录结构
```
ppt_pku/
├── SKILL.md                  # 可触发的工作流定义
├── README.md
├── design/PKU_DESIGN.md      # 设计契约
├── references/               # typography / layout / image-rules / anti-ai-slop / revision-rules
├── templates/                # left-sidebar / top-nav（theme.css + renderer.js + manifest + assets + 演示 index.html）
├── scripts/                  # 解析/构建/布局/图适配/校验/批判/修复/返修/导出/打包（纯 Node，无依赖）
│   └── lib/                  # theme · measure · render_blocks · runtime · markdown · yaml
├── docs/                     # 大纲格式 / 布局 / 图片 / 模板切换 / OD 适配 / 返修 / QA
├── examples/                 # 两份示例大纲 + 示例图片 + 返修示例 + 生成产物
└── tests/                    # eval_cases.json + run_tests.js + 各类测试大纲
```

## 一键回归
```bash
node tests/run_tests.js       # 8 类用例，纯离线
```

## 记忆 / 可复用经验
- 成功大纲 + 其 `deckConfig.json` 可作为同类汇报的起点（复制后改字）。
- 反复出现的返修（统一加粗色、某类图固定大图页）应沉淀为默认；模板细节记入 `template_manifest.json`。

## 许可与素材
北京大学校徽、博雅塔为学校标识，仅用于校内学术汇报场景；请遵守学校视觉规范。
