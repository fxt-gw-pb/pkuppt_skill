# 导出说明 · 表格密集型汇报测试

由 **ppt_pku** skill 生成的北京大学红色学术汇报 PPT。

| 项目 | 值 |
| --- | --- |
| 模板 | `left-sidebar` |
| 标题 | 表格密集型汇报测试 |
| 副标题 | 大表格自动分页校验 |
| 答辩人 / 指导老师 | 测试 / 测试 |
| 章节数 | 2 |
| 总页数 / 正文页 | 7 / 4 |
| 布局校验 | 通过（无高危问题） |
| 自我批判得分 | 100/100 |

## 如何查看
- 直接用浏览器打开 `index.html`（← / → 翻页，⎙ 按钮或 Ctrl/Cmd-P 导出 PDF）。
- 因图片为相对路径，建议本地起服务：`python3 -m http.server` 后访问。

## 文件清单
- `index.html` — 可直接打开的 HTML PPT（自包含，仅依赖 `assets/`）
- `assets/` — 校徽、装饰图与你的图片
- `source_outline.md` — 生成所用的大纲（可继续编辑后重建）
- `deckConfig.json` — 单一数据源（返修/重建以此为准）
- `slides.json` — 页面级结构（便于定位返修目标）
- `output.pdf` — 16:9 导出（如已生成）
- `layout_report.json` — 布局校验报告
- `critique_report.json` — 自我批判报告
- `revision_history.json` / `revision_report.json` — 返修记录（如有返修）

## 如何返修
```bash
node scripts/apply_revision.js output_table 返修意见.md
# 或自然语言： node scripts/apply_revision.js output_table --text "第5页图片放大；所有加粗用北大红"
```
返修只做局部修改，完成后会自动重新校验、自我批判并更新本目录。
