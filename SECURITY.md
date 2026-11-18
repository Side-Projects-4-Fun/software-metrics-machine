# Security Policy

Software Metrics Machine reads data from source control, CI/CD, issue trackers and SonarQube, and stores the results
locally. We take the security of the tool, the data it handles, and the credentials it uses seriously. This document
explains which versions receive security fixes and how to report a vulnerability responsibly.

## Supported Versions

Security fixes are shipped in the latest published version on npm (`@smmachine/launcher`). Because the project is still
in the `0.x` series, only the most recent minor line receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.8.x   | :white_check_mark: |
| < 0.8   | :x:                |

If you are running an older version, upgrade before reporting an issue so we can confirm whether the problem still
exists:

```bash
npm install -g @smmachine/launcher@latest
smm --version
```

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.**

Report vulnerabilities privately through GitHub Private Vulnerability Reporting:

- <https://github.com/Side-Projects-4-Fun/software-metrics-machine/security/advisories/new>

This opens a private advisory visible only to you and the maintainers, and lets us coordinate disclosure and a fix.

### What to include

A useful report contains:

- **Description** — the type of issue (e.g. command injection, path traversal, credential exposure, unsafe
  deserialization, XSS in the dashboard).
- **Affected version** — output of `smm --version`, plus the Node.js version and operating system.
- **Affected surface** — CLI command, REST endpoint, dashboard page, or MCP tool (e.g.
  `smm pipelines summary`, `GET /api/metrics/...`, `smm_list_metrics`).
- **Reproduction** — exact steps, commands, or a minimal project/configuration that triggers the problem.
- **Impact** — what an attacker could read, modify or execute, and what privileges are required.
- **Evidence** — logs, screenshots or a proof of concept. **Redact tokens, API keys, cookies, personal data and
  repository contents** before attaching anything.

### What to expect

| Stage                           | Target                                              |
| ------------------------------- | --------------------------------------------------- |
| Acknowledgement of the report   | within 3 business days                              |
| Initial assessment and severity | within 7 business days                              |
| Status update cadence           | at least every 10 business days while open          |
| Fix and advisory publication    | as soon as practical, coordinated with the reporter |

Accepted reports are fixed in the latest supported version and disclosed in a GitHub Security Advisory crediting the
reporter (unless you prefer to stay anonymous). Declined reports will receive an explanation of the reasoning; if we
believe the issue belongs to a third party (e.g. a Git provider, Jira, SonarQube, or the bundled Code Maat JAR), we will
say so and help route it to the right place.

Please give us a reasonable window to ship a fix before any public disclosure. We will keep you informed of progress
and agree on a disclosure date with you.

## Scope

In scope:

- The `smm` CLI and the published `@smmachine/launcher` npm package, including the bundled REST API, dashboard and MCP
  server.
- `packages/core` and `packages/utils` (providers, domain logic, SQLite persistence).
- Handling and storage of credentials and fetched project data, including redaction in MCP resources.
- The REST API and Next.js dashboard, when exposed beyond localhost by the operator.

Out of scope:

- Vulnerabilities in third-party services or tools you connect to (GitHub, GitLab, Jira, SonarQube, Code Maat/JVM, npm
  registry). Report those to the respective vendor.
- Misconfiguration of your own environment, such as committing tokens to a repository, running the dashboard on an
  untrusted network without authentication, or granting a token broader scopes than required.
- Issues that only affect unsupported versions.
- Reports produced solely by automated scanners without a demonstrated impact.
- Social engineering, physical access, and denial-of-service caused by feeding unusually large repositories or
  databases to the local tool.

## Operational hardening

Software Metrics Machine runs locally by design:

- The CLI is the only component that writes project data under `SMM_STORE_DATA_AT`. The MCP server is strictly
  read-only, and the REST API only writes saved filter definitions — no snapshots, caches or fetched data.
- Tokens can be read from project-scoped environment variables or from `smm_config.json` under `SMM_STORE_DATA_AT`.
  Prefer environment variables, never commit `smm_config.json`, and restrict its file permissions.
- Prefer tokens with the minimum scopes needed (read-only access to the repositories, projects and pipelines you
  measure), rotate them regularly, and avoid running `smm dashboard serve` on an interface reachable from untrusted
  networks — the REST API has no built-in authentication.

## Safe harbor

We will not pursue legal action against researchers who report vulnerabilities in good faith, follow this policy, avoid
privacy violations and data destruction, and do not exploit the issue beyond what is needed to demonstrate it.
