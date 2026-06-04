# TEMPLATE_SWITCHING.md — 模板选择与切换

## 两套模板
| | left-sidebar | top-nav |
| --- | --- | --- |
| 设计空间 | 1920×1080 | 1280×720 |
| 导航 | 左侧红色竖栏 | 顶部横向条 |
| 过渡页 | 无 | 有 Part.0N 过渡页 |
| 目录样式 | Part 1 / Part 2 … | 01 / 02 金色编号块 |
| 适合 | 章节少（3–4） | 章节多（≥5） |

## 选择规则
1. 用户显式 `template:`（front matter 或 `--template`）→ **必须服从**。
2. 否则自动：`sections >= 5 → top-nav`，否则 `left-sidebar`。

```bash
node scripts/build_deck.js outline.md --out output --template top-nav   # 显式
node scripts/build_deck.js outline.md --out output                      # 自动
```

## 导航/目录/Part 完全数据驱动
- 全部来自 `deck.sections`（即大纲的 `##`）。3 章显示 3 项，7 章显示 7 项。
- 删除/新增章节 → 导航、目录、Part 自动增减。
- 当前页所属章节自动高亮。Part 编号、目录编号按章节顺序自动生成。
- **绝不**在 HTML 写死"绪论背景/研究方法/…"等固定章节文本或固定的 4/5 项。
- 章节多时导航字号/间距自动缩小（`theme.nav.*` / `theme.toc.*`），保持原风格、不溢出。

## 返修中切换模板
```yaml
revision:
  - action: set_template
    to: top-nav
```
- `set_template` 会用现有 `sections` + 各内容页重新跑一遍布局（按新模板几何重新选字号/拆页），并按需补/去 Part 页。
- 若用户声明"保持模板不变"（`keep_template: true` 或自然语言"不更换模板"），`set_template` 会被忽略。
