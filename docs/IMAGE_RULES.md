# IMAGE_RULES.md — 图片插入与布局（实现说明）

规则全集见 `references/image-rules.md`；本文聚焦实现与可调项。

## 读尺寸（零依赖）
`scripts/image_fit.js` 直接解析文件头得到真实像素：PNG/JPEG/GIF/BMP/WebP，以及 SVG 的 `width/height/viewBox`。读不到则按 4:3 横图保守处理并标记 `unknown`。

## 分类 → 布局/fit
`classify(file, alt)` 返回 `{w,h,ratio,shape,fit,keepBig,preferLayout}`：
- shape：`wide(≥1.7) / tall(≤0.72) / square(0.88–1.15) / landscape`。
- fit：默认 `contain`；alt/文件名含 `背景/装饰/底图/bg/background/decor` 才 `cover`。
- keepBig：含 `流程/框架/架构/模型/结构/截图/统计/flow/chart/diagram/...` → 倾向更大图区。
- preferLayout：wide→`text-image-bottom`，tall→`text-image-right`，方/横（keepBig）→`text-image-bottom`，否则`text-image-right`。**有正文时绝不选 image-full**（避免吞掉文字）；`image-full` 仅用于"仅图无文"页。

## 容器与图注
- 结构：`figure.fig > div.fig-box > img` + `figcaption`。
- CSS 见 `references/image-rules.md`；图注居中、字号 < 正文但清晰，绑定随块移动。

## 多图与拆页
- 1/2/3–4 张分别用 right·bottom·full / `image-grid-2` / 两列 `image-grid`。
- 有正文图上限 2，无正文上限 4；超出 `layout_engine.splitPage` 自动拆为多页（保序）。

## 与校验/修复联动
- `image_too_small` → `auto_repair` 切更大图布局（right→bottom→full）或拆网格，不缩字、不丢文。
- `image_missing` → 占位框 + 报告提示补图 / `replace_image`（替换保持图注与位置绑定）。

## 示例素材
`examples/sample_images/`：`emr_structure.svg`(宽), `data_flow.svg`(宽), `model_arch.svg`(方), `result_chart.svg`(横), `portrait_sample.svg`(竖) —— 覆盖各形状用于演示与测试。
