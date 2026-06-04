# OUTLINE_FORMAT.md — 大纲文稿格式

大纲是兼容 Markdown 的纯文本。解析器：`scripts/parse_outline.js`。

## 整体结构
```markdown
---
template: top-nav            # 可选：left-sidebar | top-nav（缺省按章节数自动选）
title: 论文标题
subtitle: 副标题
presenter: 答辩人
advisor: 指导老师
date: 2026年6月
lang: zh-CN                  # 可选
---

# 目录                       # 单 # 仅作标签，被忽略

## 研究背景                  # 一级章节 → 导航栏 / 目录 / Part 页
english: Research Background # 章节英文名（用于 top-nav 的 Part 页）

### 1.1 研究背景与动机        # 页面（成为一页内容）
这里是正文段落。

这里是一个重点：**电子病历自由文本结构化是医学数据科学的重要基础**。

![结构示意图](images/emr.png)      # 插入图片
caption: 图1 电子病历结构化流程     # 图注（紧随图片，自动绑定）

### 1.2 研究意义
- 要点一
- 要点二
- **重点要点三**
```

## 解析规则
| 写法 | 含义 |
| --- | --- |
| `--- ... ---` | 全局 front matter（封面信息 + 模板 + 语言） |
| `#` | 目录/标签，忽略 |
| `##` | 一级章节（驱动导航栏、目录、Part 页；可任意增删） |
| `english:` | 紧跟 `##`，设章节英文标题 |
| `###` | 页面（一页内容） |
| 普通段落 | 正文段落（空行分段；连续行合并为一段） |
| `- ` / `* ` / `1.` | 列表项（连续成组；有序/无序分别处理） |
| `**加粗**` | 重点 → 渲染为 `.emphasis`（北大红、字重 700） |
| `*斜体*` / `` `代码` `` | 行内斜体 / 代码（可选） |
| `![alt](src)` | 图片（src 相对大纲文件解析） |
| `caption:` | 紧随图片→图注；行内 `![..](..) caption: 文字` 亦可 |
| Markdown 表格 | 表格（第二行 `---` 为分隔行） |
| `layout: xxx` | 可选：为该页指定布局（见 references/layout.md 的布局名） |

## 重要约定
- **完全遵循大纲**：章节顺序、页面顺序、内容均不被擅自重排/删减/改写。
- **自动拆页**：单页内容过满时自动拆为连续多页并加"（续）"，保持原始逻辑与顺序、页码连续。
- **图注绑定**：`caption:` 与其上方最近的、尚无图注的图片绑定，不错配。
- **章节 id**：自动生成（英文名 slug 或 `secN`），返修可用章节标题定位，无需关心 id。
- 章节数 ≥ 5 自动选 `top-nav`，否则 `left-sidebar`；`template:` 显式指定优先。

参考可运行示例：`examples/example_outline_left_sidebar.md`、`examples/example_outline_top_nav.md`。
