import { startMcpServer } from '@smmachine/mcp';
import type { SmmCommand } from './smm-command';

export function createMcpCommands(program: SmmCommand): void {
  const mcpGroup = program.subcommand('mcp').description('Model Context Protocol operations');
  const serverGroup = mcpGroup.subcommand('server').description('MCP server operations');

  serverGroup
    .subcommand('start')
    .description('Start the Software Metrics Machine MCP stdio server')
    .action(async (_options, command) => {
      const { debug } = command.getGlobalOptions();
      if (debug) {
        await startMcpServer({ debug });
        return;
      }

      await startMcpServer();
    });
}
