/**
 * Core business logic for Software Metrics Machine
 *
 * Mirrors the structure from api/src/software_metrics_machine/
 * organized into:
 * - infrastructure: Configuration, repos, external service clients
 * - domain: Business logic services, aggregates, calculations
 * - providers: Integrations with GitHub, GitLab, Jira, SonarQube, Git, CodeMaat
 * - aggregates: Repository adapters
 */

export * from './infrastructure/index';
export * from './domain/index';
export * from './providers/index';
export * from './aggregates/index';
export * from './test/index';
export * from './domain/pipelines/index'