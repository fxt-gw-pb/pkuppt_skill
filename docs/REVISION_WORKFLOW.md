# REVISION_WORKFLOW.md — 内容返修工作流

原则见 `references/revision-rules.md`；本文给输入格式、执行流程与状态文件。

## 两种输入

### A. 自然语言（Markdown，逐条）
```markdown
# 返修意见
- 第 5 页：图片放大 15%，图注保持不变。
- 第 6 页：正文拆成两页，标题分别为「1.3 研究现状（一）」和「1.3 研究现状（二）」。
- 把"研究方法"这一章的导航标题改成「研究设计与方法」。
- 全局：所有 **加粗重点** 使用北大红强调。
- 第 8 页右图和文字太挤，换成上文下图。
- 第 10 页表格太密，拆成两页。
- 删除第 6 页。
- 把图 2 换成 new.png。
- 模板：不更换模板。
- 不要动内容，只修复溢出和重叠。
```

### B. 结构化（YAML）
```yaml
revision:
  - target: slide 5
    action: enlarge_image
    amount: 15%
  - target: slide 6
    action: split_text
    strategy: preserve_order
  - target: section 研究方法
    action: rename_section
    to: 研究设计与方法
  - target: figure 2
    action: replace_image
    with: images/new.png
  - target: slide 6
    action: delete_slide
  - target: global
    action: emphasize_bold
    style: pku-red
keep_template: true
```

## 运行
```bash
node scripts/apply_revision.js output 返修意见.md
node scripts/apply_revision.js output revision.yaml
node scripts/apply_revision.js output --text "第5页图片放大；所有加粗用北大红"
```

## 定位
- 页码：`第 N 页 / slide N / pN`，指**本次返修前**的页码（一个请求内多条不串号）。
- 章节：`section 名称 / 章节 名称`，精确优先、其次包含匹配。
- 图片：`figure N / 图 N` 或图注关键字；替换保持图注与位置绑定。

## 执行流程（apply_revision）
1. 解析请求 → ops + 约束（keepTemplate / onlyLayout）。
2. 快照页码 → 逐条应用 ops（局部修改，保序，不误删）→ 末尾统一重排页码。
3. 若请求含"只修排版/修复溢出"或返修后出现高危问题 → 自动修复。
4. 重新渲染 HTML → 重新校验 → 重跑 critique →（默认）重导 PDF。
5. 追加 `revision_history.json`，写 `revision_report.json`，打印修改摘要。

## 状态与历史文件
`output/` 每次返修后保持：`source_outline.md`、`deckConfig.json`、`index.html`、`assets/`、`output.pdf`、`layout_report.json`、`critique_report.json`、`revision_history.json`、`revision_report.json`、`README_export.md`。

`revision_history.json`（数组，每次追加一条）记录：
`revision_id`、`revision_time`、`user_request`、`ops`、`constraints`、`changes`、`affected_slides`、`changed_files`、`before_summary`、`after_summary`、`validation_result`、`critique_result`、`auto_repair_applied`。

## 执行约束（务必遵守）
局部优先 · 不改大纲顺序 · 不删用户内容（除显式删除）· "只改排版"不动文案 · "保持模板"不切模板 · 返修致溢出必自动修复 · 返修后必重校验/重 critique/重生成 HTML（默认重导 PDF）· 必输出修改摘要而非仅"已完成"。
