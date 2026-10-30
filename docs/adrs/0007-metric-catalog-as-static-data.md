# ADR 0007: Metric Catalog as Static Data with Typed Implementation Bindings

Date: 2026-10-29

Status: Accepted

## Context

The application exposes metric types through four surfaces — the CLI, the REST API, the MCP server, and the
webapp — but only Engineering Health had stable identifiers. Its `MetricId` union in
`packages/core/src/engineering-health/types.ts` names 14 metrics; everything else was addressable only by a
command name, route, or tool name.

That produced three problems:

1. **No shared identity.** `coupling`, `coverage`, and `complexity` each mean different things in different
   domains, and there was no single place to answer "what metrics does this application provide?".
2. **Drift.** The webapp kept a hand-copied `EngineeringHealthMetricId` union
   (`apps/webapp/server/api/engineeringHealth.ts`) because it cannot import `@smmachine/core`.
3. **Duplicated surface knowledge.** The same computation was exposed under different names on each surface
   with no check that they stayed aligned.

A proposal was evaluated to make every metric a class implementing an identifying interface, so the catalog
could be produced by discovering classes, and to refactor domain services into a hierarchy to support it. That
proposal was rejected for the reasons recorded under Alternatives.

## Decision

Metric identity is **static data**, not runtime discovery.

### 1. Catalog metadata

`packages/core/src/domain/metrics/metric-catalog.ts` declares a `METRIC_CATALOG` object:

```ts
export const METRIC_CATALOG = {
  'cr-review-time': {
    namespace: 'cr',
    label: 'Review time',
    unit: 'days',
    direction: 'lower_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: { cli: [...], rest: [...], mcp: [...] },
  },
  // ...
} as const satisfies Record<string, MetricDefinition>;

export type CatalogMetricId = keyof typeof METRIC_CATALOG;
```

- An ID names a **metric family**, not a scalar. Statistical method, aggregation period, and scope are
  parameters and never part of the ID.
- IDs are explicit strings, kebab-case, and namespaced (`cr-`, `pl-`, `code-`, `sq-`, `arch-`, `issue-`).
  Engineering Health keeps its 14 existing unprefixed IDs and is disambiguated by `namespace: 'eh'`.
- `satisfies` validates every entry's shape; `CatalogMetricId` is derived, so consumers cannot reference an
  ID that does not exist.
- An absent `visibility` filter means **no filter** on every surface (CLI, REST, MCP). `public` and
  `internal` narrow the result; surfaces never apply a surface-specific default.

### 2. Implementation bindings

`packages/core/src/domain/metrics/metric-implementations.ts` maps every ID to a service and method:

```ts
export const METRIC_IMPLEMENTATIONS = {
  'cr-review-time': { service: 'ChangeRequestsService', method: 'getReviewTime' },
  // ...
} as const satisfies Record<CatalogMetricId, MetricMethodReference>;
```

`MetricMethodReference` is a union of valid `service`/`method` pairs derived from
`MetricServiceRegistry`, so a typo in either name fails the build. A type-level key equality assertion
(`MetricImplementationCoverage`) makes a missing or orphan binding fail the build as well.

### 3. Surface coverage (follow-up)

The catalog's `surfaces` field is checked against the real CLI command tree, REST route metadata, and MCP tool
array by tests in the owning apps. This keeps the three surfaces in sync without a shared runtime registry.

## Alternatives considered

### Class-per-metric with interface-based identity

Rejected. TypeScript interfaces are erased and cannot constrain static members. An instance `readonly id`
requires constructing the metric to read it; constructing all metrics requires a fully wired dependency graph,
so listing metrics would boot repositories and provider clients. That is unacceptable for `GET /metrics` and
`smm metrics list`, and it complicates the read-only boundary.

### Runtime discovery by scanning or decorators

Rejected. There is no runtime reflection. Decorators require adding `reflect-metadata` to `packages/core`
(not a current dependency) and rely on import side effects. Filesystem scanning is unreliable across the
tsup-bundled CLI/MCP artifacts and the Next.js standalone build, and tree-shaking can drop registration
modules. The result would be silent omission instead of a compile-time failure.

### Refactoring services into a class hierarchy

Rejected. The domain services share almost no behaviour; the only cross-domain helpers are pure functions
(`metric-samples.ts`, `metric-utils.ts`). A base class would be shallow indirection. A single-inheritance
hierarchy can encode only one of three orthogonal axes (domain, computation kind, output shape), and only the
output-shape axis has real reuse — at the presentation layer, not in computation.

## Consequences

### Positive

- One authoritative list of metric IDs, enumerable at runtime with `Object.values`.
- Adding a metric without binding it to an implementation is a compile error.
- Renaming or removing a service method breaks the binding at compile time.
- No dependency graph is needed to list metrics.
- IDs can be reviewed in a single diff and are stable by policy.

### Negative / trade-offs

- The catalog entry and the implementation binding are two edits per metric. The type system makes forgetting
  one loud rather than silent.
- Evaluation-style metrics (`cr-evaluation`, `code-evaluation`, `arch-evaluation`, …) bind to an `evaluate`
  method rather than to individual signals; signal-level IDs remain internal to the evaluation services.
- The webapp cannot import `@smmachine/core` (enforced by `.dependency-cruiser.cjs`), so it must consume a
  generated artifact or `GET /metrics`. Generation is a follow-up.

## Implementation status

- Phase 0: `metric-utils.ts` imports `MetricMethod` from `../metric-samples` instead of the `../index`
  barrel, removing the cycle risk.
- Phase 1: catalog (86 IDs across 7 namespaces), implementation bindings, and catalog tests are implemented.
- Phase 2: discovery surfaces — `smm metrics list`, `GET /metrics`, and MCP `smm_list_metrics`.
- Phase 3: bidirectional surface coverage — forward (every catalogued surface exists) and reverse (every leaf
  CLI command, REST route, and MCP tool is either catalogued or explicitly allowlisted as non-metric).
- Pending: generated docs and webapp artifact, and unification of Engineering Health's `MetricId` with
  `CatalogMetricId`.

## Addenda

- `CatalogMetricId` is a temporary name to avoid colliding with the existing Engineering Health `MetricId`.
  When Engineering Health adopts the catalog IDs, the catalog type becomes `MetricId` and the old union is
  removed.
