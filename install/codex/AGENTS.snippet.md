
## ppt_pku skill — PKU 红色学术汇报 HTML PPT
When the user asks for a **北大红 / PKU / 学术汇报 / 论文答辩 / HTML PPT**, mentions
`ppt_pku`, or wants to revise such a deck, use the installed **ppt_pku** skill at
`~/.codex/skills/ppt_pku/`. Read `~/.codex/skills/ppt_pku/SKILL.md` first and follow its
workflow (the `/ppt_pku` custom prompt is the quick entry point).

- Scripts are pure Node.js (no npm install). Run by absolute path, e.g.
  `node ~/.codex/skills/ppt_pku/scripts/build_deck.js 大纲.md --out output`.
- Follow the outline exactly; keep PKU-red academic style (no gradients/shadows/3D/emoji);
  navigation/TOC come from the outline's `##` sections; never overflow/overlap/distort.
- Only these two templates (`left-sidebar` / `top-nav`); it is not a generic design tool.
