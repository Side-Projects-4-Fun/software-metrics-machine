/**
 * Provider Integrations
 *
 * Clients for integrating with external services:
 * - GitHub: PRs, workflows, jobs
 * - GitLab: Merge requests, pipelines, jobs
 * - Jira: Issues, changelogs, comments
 * - SonarQube: Code quality metrics
 * - Git (local): Commit analysis with co-author detection
 * - CodeMaat: Code metrics from analysis
 */

export * from './github/index';
export * from './gitlab/index';
export * from './jira/index';
export * from './issues-client';
export * from './sonarqube/index';
export * from './git/index';
export * from './codemaat/index';
