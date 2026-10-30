import { describe, expect, it } from 'vitest';
import type { Command } from 'commander';
import { METRIC_CATALOG } from '@smmachine/core';
import { commands } from '../src';

/**
 * Commands that are deliberately not metric surfaces. Every other leaf command
 * must be catalogued; adding a new command forces a decision here.
 */
const NON_METRIC_CLI_COMMANDS = new Set<string>([
  // Fetch/persist commands populate the cache; they do not compute a metric.
  'change-requests fetch',
  'change-requests fetch-comments',
  'code codemaat-fetch',
  'code fetch-commits',
  'jira fetch-changelog',
  'jira fetch-comments',
  'jira fetch-issues',
  'pipelines fetch',
  'pipelines fetch-jobs',
  // Operational commands.
  'dashboard serve',
  'health-check',
  'mcp server start',
  'sonarqube analysis run',
  // Configuration and saved-filter management.
  'filters delete',
  'filters list',
  'filters save',
  'filters show',
  'project configure',
  'project delete',
  'project list',
  // Utility and discovery.
  'help',
  'metrics list',
  'tools json-merge',
]);

function collectLeafCommandPaths(command: Command, prefix = ''): string[] {
  return command.commands.flatMap((child) => {
    const name = child.name();
    const path = prefix.length === 0 ? name : `${prefix} ${name}`;

    if (child.commands.length > 0) {
      return collectLeafCommandPaths(child, path);
    }

    return [path];
  });
}

function catalogCliCommands(): string[] {
  return Object.values(METRIC_CATALOG).flatMap((definition) => definition.surfaces.cli ?? []);
}

function missingCliCommands(): string[] {
  const commandPaths = new Set(collectLeafCommandPaths(commands()));

  return catalogCliCommands().filter((command) => !commandPaths.has(command));
}

function uncataloguedCliCommands(): string[] {
  const catalogued = new Set(catalogCliCommands());

  return collectLeafCommandPaths(commands()).filter(
    (command) => !catalogued.has(command) && !NON_METRIC_CLI_COMMANDS.has(command)
  );
}

function staleAllowlistEntries(): string[] {
  return catalogCliCommands().filter((command) => NON_METRIC_CLI_COMMANDS.has(command));
}

describe('metric catalog CLI coverage', () => {
  it('exposes every catalogued CLI command', () => {
    expect(missingCliCommands()).toEqual([]);
  });

  it('classifies every leaf command as metric or explicitly non-metric', () => {
    expect(uncataloguedCliCommands()).toEqual([]);
  });

  it('does not allowlist a command that is actually catalogued', () => {
    expect(staleAllowlistEntries()).toEqual([]);
  });
});
