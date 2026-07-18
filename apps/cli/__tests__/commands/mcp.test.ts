import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';

const mocks = vi.hoisted(() => ({
  startMcpServer: vi.fn(),
}));

vi.mock('@smmachine/mcp', () => ({
  startMcpServer: mocks.startMcpServer,
}));

describe('cli: MCP Commands', () => {
  let program: Command;
  let mcpCommand: Command;
  let serverCommand: Command;

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    mocks.startMcpServer.mockResolvedValue(undefined);

    program = commands();
    mcpCommand = program.commands.find((cmd) => cmd.name() === 'mcp')!;
    serverCommand = mcpCommand.commands.find((cmd) => cmd.name() === 'server')!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('registers the mcp and mcp server command groups', () => {
    expect(mcpCommand).toBeDefined();
    expect(mcpCommand.description()).toBe('Model Context Protocol operations');

    expect(serverCommand).toBeDefined();
    expect(serverCommand.description()).toBe('MCP server operations');

    const startCommand = serverCommand.commands.find((cmd) => cmd.name() === 'start');
    expect(startCommand).toBeDefined();
    expect(startCommand?.description()).toBe('Start the Software Metrics Machine MCP stdio server');
  });

  describe('mcp server start', () => {
    it('calls startMcpServer with no arguments', async () => {
      await program.parseAsync(['mcp', 'server', 'start'], { from: 'user' });

      expect(mocks.startMcpServer).toHaveBeenCalledTimes(1);
      expect(mocks.startMcpServer).toHaveBeenCalledWith();
    });
  });
});
