# references/revision-rules.md — 返修规则

由 `scripts/apply_revision.js`（解析）+ `scripts/revision_engine.js`（执行）落实。完整流程见 `docs/REVISION_WORKFLOW.md`。

## 核心原则
1. **优先局部修改，不要无理由全量重做。** 只动被指定的页/章节/图/表。
2. **不要擅自改变大纲顺序**，不要合并/重排章节。
3. **不要擅自删除用户内容**；仅 `delete_slide` 这类显式指令才删。
4. 用户说"只改排版"→ 不改文案；"只改内容"→ 尽量不动模板结构；"保持模板不变"→ 不切模板。
5. 返修若导致溢出/重叠/字号过小 → **必须自动修复**（调用 auto_repair）。
6. 返修后**必须重新校验、重跑 critique、重新生成 HTML**，需要时重导 PDF。
7. 返修后**必须写 `revision_history.json` 与 `revision_report.json`**，并输出修改摘要（不是只说"已完成"）。

## 定位方式
- **页码**：按当前 PPT 的实际页码定位；一个请求内的多条页码均指"本次返修前"的页码（批内不串号）。
- **章节名 / sectionId**：精确匹配优先，其次包含匹配。
- **图片**：按"图 N"或图注关键字定位；找不到再按文档内第 N 张图。
- **替换图片**：保持图片与原图注、原位置（或用户指定位置）的绑定关系不变。

## 支持的操作（NL 与结构化均可）
`enlarge_image`（放大→升级到更大图布局，保文字可见）·`change_layout`·`split_text`（保序拆页，可指定续页标题）·`split_table`（按行拆页不丢行）·`rename_section`（联动导航/目录/Part）·`emphasize_bold`（pku-red/dark/plain）·`replace_image`（保图注绑定）·`delete_slide`·`set_template`（受"保持模板"约束）·`reflow`（只交给自动修复）。

## 返修后自检
- 内容没被误删？章节顺序不变？页码、目录、导航仍正确？
- 替换的图与原图注是否仍绑定？拆出的续页是否都非空？
- `validate_layout` 无高危、`critique` 无漂移？历史与报告是否写入？
