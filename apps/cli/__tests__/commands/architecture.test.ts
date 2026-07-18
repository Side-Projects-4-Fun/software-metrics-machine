import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';
import { ArchitectureService } from '@smmachine/core';

describe('cli: Architecture Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let generateSnapshotSpy: ReturnType<typeof vi.spyOn>;
  let listSnapshotsSpy: ReturnType<typeof vi.spyOn>;
  let getViewSpy: ReturnType<typeof vi.spyOn>;

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    generateSnapshotSpy = vi
      .spyOn(ArchitectureService.prototype, 'generateSnapshot')
      .mockResolvedValue({
        snapshotId: 'project-2026-07-18T00-00-00-000Z',
        generatedAt: '2026-07-18T00:00:00.000Z',
        project: 'owner/repo',
        branch: 'main',
        commitCount: 42,
        views: [
          {
            id: 'container',
            level: 'container',
            title: 'Container View',
            nodes: [],
            edges: [],
          },
        ],
      });

    listSnapshotsSpy = vi.spyOn(ArchitectureService.prototype, 'listSnapshots').mockResolvedValue([
      {
        snapshotId: 'project-2026-07-18T00-00-00-000Z',
        generatedAt: '2026-07-18T00:00:00.000Z',
        project: 'owner/repo',
        branch: 'main',
        commitCount: 42,
        availableViews: ['context', 'container', 'component', 'code'],
      },
    ]);

    getViewSpy = vi.spyOn(ArchitectureService.prototype, 'getView').mockResolvedValue({
      id: 'container',
      level: 'container',
      title: 'Container View',
      nodes: [
        {
          id: 'container:apps-cli',
          kind: 'container',
          name: '@smmachine/cli',
          technology: 'Node.js CLI',
        },
      ],
      edges: [],
    });

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('architecture generate', () => {
    it('forwards date filters and refresh-git flag to ArchitectureService.generateSnapshot', async () => {
      await program.parseAsync(
        [
          'architecture',
          'generate',
          '--start-date',
          '2026-01-01',
          '--end-date',
          '2026-01-31',
          '--refresh-git',
        ],
        { from: 'user' }
      );

      expect(generateSnapshotSpy).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        refreshGit: true,
      });
    });

    it('defaults refreshGit to false when --refresh-git is omitted', async () => {
      await program.parseAsync(['architecture', 'generate'], { from: 'user' });

      expect(generateSnapshotSpy).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        refreshGit: false,
      });
    });

    it('prints snapshot summary in text output', async () => {
      await program.parseAsync(['architecture', 'generate'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Architecture Snapshot Generated ===');
      expect(output).toContain('Snapshot ID: project-2026-07-18T00-00-00-000Z');
      expect(output).toContain('Project: owner/repo');
      expect(output).toContain('Commits considered: 42');
      expect(output).toContain('container (0 nodes / 0 edges)');
    });

    it('prints snapshot as JSON when --output json is provided', async () => {
      await program.parseAsync(['architecture', 'generate', '--output', 'json'], {
        from: 'user',
      });

      const jsonLine = consoleSpy.mock.calls
        .map((call) => call[0])
        .find((value): value is string => typeof value === 'string' && value.startsWith('{'));
      expect(jsonLine).toBeDefined();

      const parsed = JSON.parse(jsonLine!);
      expect(parsed.snapshotId).toBe('project-2026-07-18T00-00-00-000Z');
      expect(parsed.project).toBe('owner/repo');
      expect(parsed.commitCount).toBe(42);
    });
  });

  describe('architecture list-snapshots', () => {
    it('calls ArchitectureService.listSnapshots with no arguments', async () => {
      await program.parseAsync(['architecture', 'list-snapshots'], { from: 'user' });

      expect(listSnapshotsSpy).toHaveBeenCalledWith();
    });

    it('prints snapshots in text output', async () => {
      await program.parseAsync(['architecture', 'list-snapshots'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Architecture Snapshots ===');
      expect(output).toContain(
        'project-2026-07-18T00-00-00-000Z | 2026-07-18T00:00:00.000Z | commits=42 | views=context,container,component,code'
      );
    });

    it('prints a hint when no snapshots are persisted', async () => {
      listSnapshotsSpy.mockResolvedValueOnce([]);

      await program.parseAsync(['architecture', 'list-snapshots'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('No snapshots found. Run: smm architecture generate');
    });

    it('prints snapshots as JSON when --output json is provided', async () => {
      await program.parseAsync(['architecture', 'list-snapshots', '--output', 'json'], {
        from: 'user',
      });

      const jsonLine = consoleSpy.mock.calls
        .map((call) => call[0])
        .find((value): value is string => typeof value === 'string' && value.startsWith('{'));
      expect(jsonLine).toBeDefined();

      const parsed = JSON.parse(jsonLine!);
      expect(parsed.snapshots).toHaveLength(1);
      expect(parsed.snapshots[0].snapshotId).toBe('project-2026-07-18T00-00-00-000Z');
    });
  });

  describe('architecture export', () => {
    it('forwards view level and snapshot id to ArchitectureService.getView', async () => {
      await program.parseAsync(
        ['architecture', 'export', '--view', 'component', '--snapshot-id', 'snap-123'],
        { from: 'user' }
      );

      expect(getViewSpy).toHaveBeenCalledWith('component', 'snap-123');
    });

    it('defaults view to container and snapshot-id to undefined', async () => {
      await program.parseAsync(['architecture', 'export'], { from: 'user' });

      expect(getViewSpy).toHaveBeenCalledWith('container', undefined);
    });

    it('prints the view as JSON by default', async () => {
      await program.parseAsync(['architecture', 'export'], { from: 'user' });

      const jsonLine = consoleSpy.mock.calls
        .map((call) => call[0])
        .find((value): value is string => typeof value === 'string' && value.startsWith('{'));
      expect(jsonLine).toBeDefined();

      const parsed = JSON.parse(jsonLine!);
      expect(parsed.level).toBe('container');
      expect(parsed.nodes[0].name).toBe('@smmachine/cli');
    });

    it('prints a mermaid diagram when --format mermaid is provided', async () => {
      await program.parseAsync(['architecture', 'export', '--format', 'mermaid'], {
        from: 'user',
      });

      const output = getOutput();

      expect(output).toContain('flowchart LR');
      expect(output).toContain('container_apps_cli["@smmachine/cli\\nNode.js CLI"]');
    });
  });
});
