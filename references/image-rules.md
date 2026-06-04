# references/image-rules.md — PKU PPT 图片规则

由 `scripts/image_fit.js`（读尺寸+分类）与 `scripts/lib/render_blocks.js`（容器+图注）落实。

## 硬性规则
1. **保持原始宽高比，绝不拉伸变形。**
2. 默认 `object-fit: contain`，完整显示。
3. 仅**装饰性背景图**（alt/文件名含 `背景/装饰/底图/bg/background/decor`）允许 `object-fit: cover`。
4. 所有图片必须放入明确容器 `.fig > .fig-box > img`，不裸放。
5. 图片容器位于内容安全区内，**不得覆盖**：页面标题、导航栏、页码、页眉页脚、图注、其它正文。

## 形状识别与布局选择
`image_fit.classify()` 读真实像素算宽高比：
- 宽图（ratio ≥ 1.7）→ `text-image-bottom`（有文）或 `image-full`（无文）。
- 竖图（ratio ≤ 0.72）→ `text-image-right`。
- 方图（0.88–1.15）/ 一般横图 → `text-image-right`；含"流程/框架/架构/模型/结构/截图/统计/flow/chart/diagram"等关键字（`keepBig`）→ 倾向更大图区。
- 流程图/截图/统计图：优先保证清晰、尽量大、完整显示、不裁剪。

## 图注
- `caption:` 紧随图片即与之**绑定**（随块移动，不错配）。
- 图注字号小于正文但清晰（left ≥18 / top ≥12），居中置于图下，与正文有足够间距。

## 数量与尺寸自适应
- 1 图：right/bottom/full。2 图：左右网格。3–4 图：均匀两列网格，互不重叠。
- 图过多：自动拆为多页（有文上限 2 / 无文上限 4）。
- 图过大不得挤压正文到不可读：改为 上文下图 / 左文右图 / 独立大图页 / 多图网格页 / 自动拆页。
- 图显示尺寸过小（left <150px / top <100px）→ 校验报 `image_too_small`，`auto_repair` 切换更大图布局（right→bottom→full）或拆网格。

## 缺图处理
文件缺失 → 渲染为带说明的占位框（不破坏版式），校验报 `image_missing`，提示补图或 `replace_image`。

## 容器 CSS（核心）
```css
.fig-box{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.fig-box img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;object-position:center;}
```
按各模板安全区尺寸封装，确保图片不撑破版面。
