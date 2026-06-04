# LAYOUT_RULES.md — 布局与校验规则（实现说明）

设计原则与布局类型详见 `references/layout.md`；本文聚焦实现细节与校验判据。

## 几何单一数据源
`scripts/lib/theme.js` 定义两套模板的设计空间、安全区、字号阶梯与下限、导航自适应函数。渲染器、布局引擎、校验器、修复器**全部**引用它，确保"画的"和"量的"一致。

## 安全区
| 模板 | 内容安全区 |
| --- | --- |
| left-sidebar | `x338 y240 w1492 h750` |
| top-nav（无红条，默认） | `x101 y170 w1078 h486` |
| top-nav（有红条） | `x101 y320 w1078 h336` |

## 流式排布（防重叠 / 防变形 / 防溢出）
- 安全区放一个固定尺寸容器，内部 flex/grid 流式 → 块间不重叠。
- `object-fit:contain` → 图不变形；`max-width/height:100%` → 图不撑破。
- 唯一风险=流式内容比容器高 → 由 `scripts/lib/measure.js` 估算并校验。

## 文本高度估算（measure.js）
- 行宽：中文≈1.0em、英文/数字≈0.55em（`avgCharWidth`），按列宽算每行字数。
- 行高 `1.7`；逐块累加（段落、列表项含间距）。
- 各布局的文本列尺寸见 `measure.textRegion()`；图片盒尺寸见 `measure.imageBoxes()`。
- 选字号：阶梯从大到小，取**首个能放下**的；都放不下则取下限并标记需拆页。

## 校验项（validate_layout.js → layout_report.json）
| 类型 | 触发 | 严重度 |
| --- | --- | --- |
| `text_overflow` | 正文流式高度 > 安全区 | high |
| `font_too_small` | 正文字号 < 模板下限 | high |
| `table_too_dense` | 表格行高合计 > 安全区 | high |
| `table_too_wide` | 列数 × 最小列宽 > 安全区宽 | medium |
| `image_too_small` | 图显示最短边 < left150/top100 | medium |
| `image_missing` | 图片文件缺失 | medium |
| `nav_overflow` | 导航估算尺寸 > 可用空间 | medium |
| `page_discontinuous` | 内容页页码不连续 | high |
| `geometry` | 安全区超出页面（模板常量异常） | high |

`pass` = 无 high 且无 medium；`passNoHigh` = 无 high（自动修复以此为通过线）。

## 自动修复（auto_repair.js）
顺序与原则：先调布局（如 `image_too_small`：right→bottom）、再按"每页可容"拆表/拆文、不低于最小字号、不改文案、不改章节顺序、不引入新风格；每轮后重校验，最多 3 轮。产出 `repair_report.json`。

> 可选增强：若环境装有 Playwright，可在浏览器渲染后用真实 `getBoundingClientRect` 复核；本 skill **默认不依赖**它——确定性几何模型已足以判定溢出/重叠。
