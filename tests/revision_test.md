# 返修测试（结构化 YAML 形式）
#
# run_tests.js 会先用 examples/example_outline_left_sidebar.md 生成一份 deck，
# 再把下面的 YAML 作为返修请求应用，校验：局部修改、内容不丢失、页码/导航正确、
# 替换图片保持图注绑定、删除页生效、模板保持不变、返修后自动校验通过。

revision:
  - target: slide 1
    action: enlarge_image
    amount: 20%
  - target: slide 2
    action: split_text
    strategy: preserve_order
  - target: section 研究方法
    action: rename_section
    to: 研究设计与方法
  - target: figure 4
    action: replace_image
    with: ../examples/sample_images/portrait_sample.svg
  - target: slide 7
    action: delete_slide
  - target: global
    action: emphasize_bold
    style: pku-red
  - action: keep_template
keep_template: true
