# ADR 0001: Bootstrap Technology Stack

Date: 2025-12-29

Status: Superseded by ADR 0002

## Context

When starting the Software Metrics Machine project, we needed to choose a technology stack that would enable rapid
development of data analysis and visualization capabilities. The project's primary focus is analyzing software
repositories to extract metrics about code quality, CI/CD pipelines, and pull requests. Key requirements included:

- Strong data processing and analysis capabilities
- Easy integration with version control systems and APIs
- Quick visualization prototyping
- Minimal overhead for UI/CSS development
- Cross-platform compatibility

## Decision

We decided to use Python as the sole programming language for the project, with Panel as the visualization framework.

### Python Language

Python was chosen as the exclusive technology for several reasons:

1. Rich Data Ecosystem: Python has an extensive ecosystem of mature libraries for data analysis:
   - `pandas` for data manipulation and analysis
   - `pydriller` for Git repository mining
   - `requests` for API interactions
   - Scientific computing libraries when needed

2. Universal Availability: Python is available across virtually all operating systems and platforms, ensuring the tool can be used by the widest possible audience without compatibility concerns.

3. Developer Productivity: Python's readable syntax and extensive standard library enable rapid prototyping and iteration.

4. Strong Community: Large community support means easier troubleshooting and access to third-party integrations.

### Panel Framework

For visualization and dashboard creation, we chose Panel:

1. Rapid Prototyping: Panel allows creating interactive visualizations and dashboards without writing HTML, CSS, or JavaScript.

2. Python-Native: Being a pure Python framework, Panel integrates seamlessly with our data processing pipeline without requiring context switching between languages.

3. Quick Visual Aid: Panel provides built-in widgets and plotting capabilities through HoloViews/Bokeh integration, enabling us to create charts and visual representations quickly.

4. Focus on Logic: By abstracting away UI/CSS concerns, Panel allowed us to focus on the core analysis logic and data transformations rather than presentation layer details.

## Consequences

### Positive

- Unified Codebase: Single-language codebase simplifies development, testing, and deployment.
- Fast Iteration: Quick prototyping and visualization without UI/CSS expertise requirements.
- Rich Tooling: Access to Python's extensive data science ecosystem.
- Easy Onboarding: Developers familiar with data analysis can contribute immediately.
- Cross-Platform: Works consistently across Windows, macOS, and Linux.
- Pypi as a central distribution point made it easy to share and install the tool.

### Negative

- Performance: Python may be slower than compiled languages for intensive computations.
- Dashboard Limitations: Panel dashboards may have limitations compared to dedicated frontend frameworks for complex interactions.
- Deployment Complexity: Python applications can require careful dependency management.
- Developer experience: Python data analysis and web visualization may be more challenging than using more common web stacks for fine tune UI/UX or complex interactions.

### Neutral

- Technology Lock-in: Commitment to Python ecosystem; migrating to other languages would require significant effort.
- Future Migration: Should requirements change (e.g., need for more sophisticated UI), migration to frameworks like Next.js would be necessary (as evidenced by the recent dashboard migration).

## Alternatives Considered

1. JavaScript/TypeScript with Node.js: While offering better frontend capabilities, would have required additional tooling
for data analysis and lacked Python's data science ecosystem.

2. R Language: Strong for statistical analysis but less general-purpose than Python and with a smaller ecosystem for web APIs and Git operations.

3. Mixed Stack (Python + React/Vue): Would have provided better UI capabilities but at the cost of increased complexity and requiring frontend expertise from the start.
