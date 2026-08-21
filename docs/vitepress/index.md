---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Software metrics machine"
  text: "Understand how your software delivery system behaves"
  tagline: Local-first engineering metrics for teams that want better conversations
  image: ./data-analysis.png
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: What is Software Metrics Machine?
      link: /what-is-smm
features:
  - title: Keep engineering data local
    details: Collect and analyze repository data on your own machine, with the data directory under your control.
    link: ./privacy-first.md
  - title: Connect the tools you already use
    link: ./supported-providers.md
    details: Start with GitHub or GitLab, then combine delivery, code, quality, and issue data.
  - title: Move from charts to decisions
    details: Explore trends, compare date ranges, and use engineering-health signals to decide where to investigate next.
    link: ./features.md
---

## See value before you instrument everything

SMM turns the data already produced by your delivery system into a local dashboard and CLI. Start with a single
repository, inspect a small date range, and decide whether the metrics help your team ask better questions.

```bash
npx @smmachine/launcher
smm project configure
smm change-requests fetch --start-date 2025-01-01 --end-date 2025-01-31
smm dashboard serve
```

Open `http://localhost:3000` to explore the result. The [getting started guide](./getting-started.md) explains the
full setup, including provider tokens, local storage, and optional code-history analysis.

## Built for two conversations

### For developers

- Find slow review and delivery paths without assembling spreadsheets.
- Connect change requests, pipelines, source code, and quality signals in one place.
- Keep investigation data available locally for repeatable analysis.

### For tech leads

- Bring evidence to discussions about flow, quality, and technical debt.
- Look at trends and distributions instead of treating one metric as a target.
- Give the team a shared starting point for improvement experiments.

SMM is an observability tool for the engineering system, not a scorecard for individuals. Read [What is SMM?](./what-is-smm.md)
for the measurement principles behind the project.

## Choose your next step

- **Try the tool:** follow [Getting started](./getting-started.md).
- **Understand the metrics:** browse [Features](./features.md) and [Supported providers](./supported-providers.md).
- **Evaluate the architecture:** read about the [REST API](./rest-api.md), [MCP server](./mcp.md), and [privacy model](./privacy-first.md).
