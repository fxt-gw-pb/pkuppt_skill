'use strict';
/* =============================================================================
 * package_output.js — assemble the final handoff folder.
 *
 *   node package_output.js <output/> [--no-pdf]
 *
 * Ensures the deck has a validation report, a critique report, an export PDF
 * (via headless Chrome when available) and a human-readable README_export.md,
 * then prints the manifest. Idempotent — safe to run after any build/repair/
 * revision. It does NOT change slide content.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { loadDeck, validate } = require('./validate_layout');
const critiqueMod = require('./critique_deck');

function ensureReports(dir, deck) {
  const lp = path.join(dir, 'layout_report.json');
  if (!fs.existsSync(lp)) fs.writeFileSync(lp, JSON.stringify(validate(deck), null, 2));
  const cp = path.join(dir, 'critique_report.json');
  if (!fs.existsSync(cp)) {
    const html = fs.existsSync(path.join(dir, 'index.html')) ? fs.readFileSync(path.join(dir, 'index.html'), 'utf8') : '';
    fs.writeFileSync(cp, JSON.stringify(critiqueMod.critique(deck, html), null, 2));
  }
}

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

function writeReadme(dir, deck) {
  const layout = readJSON(path.join(dir, 'layout_report.json')) || {};
  const crit = readJSON(path.join(dir, 'critique_report.json')) || {};
  const m = deck.meta || {};
  const content = deck.slides.filter(s => s.type === 'content').length;
  const md = `# 导出说明 · ${m.title || 'PKU HTML PPT'}

由 **ppt_pku** skill 生成的北京大学红色学术汇报 PPT。

| 项目 | 值 |
| --- | --- |
| 模板 | \`${deck.template}\` |
| 标题 | ${m.title || ''} |
| 副标题 | ${m.subtitle || ''} |
| 答辩人 / 指导老师 | ${m.presenter || ''} / ${m.advisor || ''} |
| 章节数 | ${deck.sections.length} |
| 总页数 / 正文页 | ${deck.slides.length} / ${content} |
| 布局校验 | ${layout.passNoHigh ? '通过（无高危问题）' : '存在问题，见 layout_report.json'} |
| 自我批判得分 | ${crit.overall_score != null ? crit.overall_score + '/100' : 'N/A'} |

## 如何查看
- 直接用浏览器打开 \`index.html\`（← / → 翻页，⎙ 按钮或 Ctrl/Cmd-P 导出 PDF）。
- 因图片为相对路径，建议本地起服务：\`python3 -m http.server\` 后访问。

## 文件清单
- \`index.html\` — 可直接打开的 HTML PPT（自包含，仅依赖 \`assets/\`）
- \`assets/\` — 校徽、装饰图与你的图片
- \`source_outline.md\` — 生成所用的大纲（可继续编辑后重建）
- \`deckConfig.json\` — 单一数据源（返修/重建以此为准）
- \`slides.json\` — 页面级结构（便于定位返修目标）
- \`output.pdf\` — 16:9 导出（如已生成）
- \`layout_report.json\` — 布局校验报告
- \`critique_report.json\` — 自我批判报告
- \`revision_history.json\` / \`revision_report.json\` — 返修记录（如有返修）

## 如何返修
\`\`\`bash
node scripts/apply_revision.js ${path.basename(dir)} 返修意见.md
# 或自然语言： node scripts/apply_revision.js ${path.basename(dir)} --text "第5页图片放大；所有加粗用北大红"
\`\`\`
返修只做局部修改，完成后会自动重新校验、自我批判并更新本目录。
`;
  fs.writeFileSync(path.join(dir, 'README_export.md'), md);
}

async function run(dir, opts = {}) {
  const { deck } = loadDeck(dir);
  ensureReports(dir, deck);
  writeReadme(dir, deck);
  let pdf = fs.existsSync(path.join(dir, 'output.pdf'));
  if (!pdf && opts.pdf !== false) {
    try { const r = await require('./export_pdf').exportPdf(dir); pdf = r.ok; } catch { /* leave for manual print */ }
  }
  const want = ['index.html', 'deckConfig.json', 'slides.json', 'source_outline.md', 'layout_report.json', 'critique_report.json', 'README_export.md', 'output.pdf', 'revision_history.json', 'revision_report.json'];
  const manifest = want.map(f => ({ file: f, present: fs.existsSync(path.join(dir, f)) }));
  return { dir, manifest, pdf };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) { console.error('usage: node package_output.js <output/> [--no-pdf]'); process.exit(1); }
  run(path.resolve(dir), { pdf: !args.includes('--no-pdf') }).then(({ manifest }) => {
    console.log('packaged output:');
    for (const m of manifest) console.log(`  ${m.present ? '✓' : '·'} ${m.file}`);
  });
}

module.exports = { run, writeReadme };
