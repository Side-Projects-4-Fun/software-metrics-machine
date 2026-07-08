---
name: update-vitepress-docs
description: "VitePress documentation workflow for Software Metrics Machine docs under docs/vitepress. Use when creating, updating, reviewing, or restyling SMM documentation pages, especially feature docs that must keep CLI terminal examples and dashboard views/screenshots in sync. Covers Markdown style, VitePress tabs, command examples, dashboard screenshots, sidebar links, and docs validation. USE FOR: docs/vitepress, VitePress docs, documentation style, CLI docs, dashboard docs, screenshots, feature pages. DO NOT USE FOR: application code changes unless needed to verify documented behavior."
---

# Update VitePress Docs

## Scope

Use this skill for documentation changes under `docs/vitepress`. The docs should teach the same feature from two angles:

- CLI: how the behavior looks from the terminal, with copyable `smm` commands and realistic output or option context.
- Dashboard: how the same behavior appears in the web UI, with route names, filter behavior, and screenshots when a visual exists.

Keep pages practical and user-facing. Prefer concrete workflows, exact commands, stable screenshots, and short explanations over broad marketing copy.

## Documentation Map

- `docs/vitepress/features/*.md`: dashboard feature pages and metric pages. These usually need CLI/dashboard parity.
- `docs/vitepress/github/*.md`, `docs/vitepress/codemaat/*.md`, provider pages: data collection and integration flows. Keep CLI commands explicit and link to feature/dashboard pages for visualization.
- `docs/vitepress/tools/*.md`: utility command docs.
- `docs/vitepress/features/dashboard.md`: shared dashboard behavior, filters, saved views, date/timezone behavior, and URL format.
- `docs/vitepress/public/dashboard/**`: dashboard screenshots used by feature pages.
- `docs/vitepress/.vitepress/config.mts`: sidebar and navigation. Update it when adding or moving pages.

## Workflow

1. Inspect nearby docs before editing. Match the closest feature/provider page instead of inventing a new structure.
2. Identify whether the change affects CLI, dashboard, or both. If both surfaces exist, document both in the same feature section.
3. Verify command names and flags from source code or existing tests before writing examples.
4. Verify dashboard routes, filters, screenshot paths, and terminology from the webapp or existing docs.
5. Update sidebar links in `docs/vitepress/.vitepress/config.mts` when adding or renaming pages.
6. Run a docs build or targeted markdown checks when the change touches links, frontmatter, tabs, or config.

## Page Style

- Use sentence-case headings after the page title, except product names and command names.
- Keep introductions short: one paragraph that says what the page helps the reader do.
- Use active voice and concrete nouns. Prefer "Run `smm prs fetch`" over "The command can be executed".
- Use `Software Metrics Machine` or `SMM` consistently; use `smm` only for the CLI binary.
- Do not over-explain obvious Markdown, UI controls, or command syntax.
- Prefer stable examples with fixed dates, repository names, and project names.
- Wrap commands in fenced `bash` blocks. Wrap dashboard URLs and API query examples in `text` blocks when they are not shell commands.
- Use tables for option references only when the options are central to the page. Keep wide tables concise.
- Link to shared dashboard behavior with `[Dashboard](./dashboard.md)` from feature pages or the correct relative path from other folders.

## CLI and dashboard parity

For feature pages, keep each metric or workflow section synchronized:

1. Name the user task or metric.
2. Explain where it appears in the dashboard tab.
3. Show the dashboard screenshot when one exists.
4. Show the equivalent CLI command.
5. Document shared filters once, then reference them from each metric section.

Use VitePress tabs when a section naturally compares visual and terminal usage:

~~~~markdown
::::tabs key:cli
:::tab Dashboard
![Readable dashboard alt text](/dashboard/path/to-screenshot.png)

The dashboard card appears in the Feature tab and uses the shared date filters.
:::

:::tab CLI
```bash
smm feature command --start-date 2026-01-01 --end-date 2026-01-31
```
:::
::::
~~~~

When no screenshot exists, still describe the dashboard location and route. Do not invent screenshots or image paths.

## Dashboard Screenshot Rules

- Store dashboard screenshots under `docs/vitepress/public/dashboard/**`.
- Reference screenshots with root-relative paths such as `/dashboard/pipelines/runs_in_minutes.png`.
- Use alt text that names the chart or page, not generic text like "screenshot".
- Keep screenshot names stable and descriptive with lowercase words separated by underscores or hyphens, following nearby files.
- If a documented dashboard state depends on filters, mention the relevant filters near the screenshot.

## CLI Example Rules

- Prefer command examples that can be copied as-is.
- Include `--project` when the example depends on a named repository or multi-project setup.
- Include `--start-date`, `--end-date`, and timezone context when date boundaries matter.
- Keep long commands readable with backslash line continuations.
- Do not document flags from memory. Confirm command names and options from CLI source, tests, or existing docs first.
- If showing output, keep it short and stable. Avoid transient IDs, local absolute paths, and machine-specific timings.

## Validation

Use the smallest validation that covers the change:

- Markdown-only edits: inspect rendered-sensitive syntax manually, especially tabs, fenced code blocks, tables, and links.
- New or moved pages: verify `docs/vitepress/.vitepress/config.mts` sidebar entries.
- Link, image, frontmatter, or VitePress config changes: run the VitePress build from `docs/vitepress` when practical.

Common docs commands:

```bash
cd docs/vitepress
npm run docs:build
```

If dependencies are missing or the build cannot run because network access is required, report that clearly and state which files were checked manually.
