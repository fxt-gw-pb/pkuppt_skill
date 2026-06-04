You are operating the **ppt_pku** skill — generate / validate / auto-repair / revise / export
北京大学红 (PKU-red) academic HTML presentation decks from a Markdown outline, images, tables,
and revision requests, using the two bundled PKU templates (`left-sidebar` 1920×1080 /
`top-nav` 1280×720). It is NOT a generic design platform — only these two PKU templates.

Skill location (read these BEFORE acting):
- `~/.codex/skills/ppt_pku/SKILL.md`            (the executable workflow)
- `~/.codex/skills/ppt_pku/design/PKU_DESIGN.md` (the PKU design contract)
- `~/.codex/skills/ppt_pku/docs/OUTLINE_FORMAT.md` and `docs/REVISION_WORKFLOW.md`
- `~/.codex/skills/ppt_pku/references/*.md`       (typography / layout / image-rules / anti-ai-slop / revision-rules)

All scripts are pure Node.js (zero npm deps). Run them by absolute path from the user's
current project directory; output goes to a local `output/` folder. PDF export uses the
machine's headless Chrome/Edge.

## Rules (hard constraints)
- Follow the user's outline EXACTLY: do not reorder / delete / rewrite core content. Over-full
  pages auto-split into ordered "（续）" pages; never overflow, overlap, distort images, or hide text.
- Navigation / TOC / Part pages come from the outline's `##` sections (never hard-code 4/5 items).
- Keep the PKU-red academic style: no gradients / shadows / 3D / emoji / over-rounded cards.
- Template choice: honor an explicit `template:`; otherwise `sections >= 5 → top-nav`, else `left-sidebar`.
- Revisions are surgical and local; never delete user content unless explicitly told; re-validate after.

## Pipeline (run from the user's project dir; replace paths as needed)
```bash
SK=~/.codex/skills/ppt_pku
node $SK/scripts/build_deck.js 大纲.md --out output [--template left-sidebar|top-nav]
node $SK/scripts/validate_layout.js output
node $SK/scripts/critique_deck.js  output
node $SK/scripts/auto_repair.js    output          # if validate/critique flag issues
node $SK/scripts/export_pdf.js     output          # output/output.pdf (16:9)
node $SK/scripts/package_output.js output          # README_export.md + manifest
# revision (natural language OR a YAML/Markdown file):
node $SK/scripts/apply_revision.js output --text "第5页图片放大；所有加粗用北大红"
node $SK/scripts/apply_revision.js output 返修意见.md
```
After building/revising, briefly report: template used, slide count, validation pass, critique
score, and what changed — then point the user at `output/index.html` (open in a browser) and `output/output.pdf`.

## The user's request
$ARGUMENTS

If the request is empty, ask the user for: the outline (or topic), any images/tables, the
desired template (or let it auto-pick), and whether they want a fresh deck or a revision of an
existing `output/` deck.
