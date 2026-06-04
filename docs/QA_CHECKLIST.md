# QA_CHECKLIST.md — 交付前自查清单

每次生成或返修后，按此清单核对（多数项由 `validate_layout.js` / `critique_deck.js` / `tests/run_tests.js` 自动覆盖）。

## 大纲忠实度
- [ ] 章节顺序、页面顺序、内容均未被擅自重排/删减/改写。
- [ ] 超长内容自动拆为连续多页（保序、加"（续）"、页码连续）。
- [ ] 图片插在对应位置附近，图与图注绑定不错配；表格在对应页或其拆分页。

## 导航 / 目录 / Part
- [ ] 导航项数量 = 大纲一级章节数（非写死 4/5）。
- [ ] 当前页所属章节高亮；目录、Part 编号自动生成且与章节同步。
- [ ] 增删章节后导航/目录/Part 同步增减。

## 图片与布局
- [ ] 不变形（contain）、不溢出、不遮挡标题/导航/页码/图注/正文。
- [ ] 多图布局合理；图注清晰美观；图过小已放大或换大图布局；图过多已拆页。

## 字体与重点
- [ ] 正文 ≥ 模板下限（left 24 / top 16），标题清晰；图注 ≥ 下限。
- [ ] `**加粗**` 渲染为醒目 `.emphasis`；无未渲染的 `**` 残留。

## Critique 与自动修复
- [ ] `critique_report.json` 生成；`overall_score` 合理；`template_drift=false`。
- [ ] 无渐变/阴影/3D/emoji/过度圆角等 AI slop。
- [ ] `layout_report.json` 生成；`auto_repair` 已修复可修复项并重校验。

## 返修
- [ ] 局部修改，未误删内容；章节顺序不变；页码/目录/导航仍正确。
- [ ] 可按页码/章节/图片定位；替换图保持图注绑定；拆出的续页均非空。
- [ ] `revision_report.json` / `revision_history.json` 已写入；输出了修改摘要。

## 导出与交付
- [ ] `index.html` 浏览器可直接打开；PDF 16:9 正常导出（或给出手动打印指引）。
- [ ] `output/` 含全部交付文件（见 SKILL.md §13）。

## 范围红线（Open Design 适配）
- [ ] 未引入 GUI / MCP / 插件市场 / 无关设计系统 / 网页·App·视频·海报能力。
- [ ] 仅服务两套 PKU 模板；未改变 PKU 红学术风格。

## 一键回归
```bash
node tests/run_tests.js
```
