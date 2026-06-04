---
template: left-sidebar
title: Critique 检测测试
subtitle: 风格漂移与未渲染加粗检测
presenter: 测试
advisor: 测试
date: 2026年6月
---

# 目录

## 背景
english: Background

### 1.1 正常页
正常的一页，包含一个**加粗重点**，critique 应识别为已正确渲染。

## 方法
english: Methods

### 2.1 正常页
本页用于配合 run_tests.js：测试会向生成的 index.html 注入一处渐变/阴影样式，
critique_deck.js 必须将其报告为 template_drift，证明自我批判能发现风格漂移。
