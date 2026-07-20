import { startMcpServer } from '@smmachine/mcp';
import type { SmmCommand } from './smm-command';

/**
 * MCP Command Group
 *
 * Commands:
 *   smm mcp server start   Start the MCP stdio server
 */
export function createMcpCommands(program: SmmCommand): void {
  const mcpGroup = program.subcommand('mcp').description('Model Context Protocol operations');
  const serverGroup = mcpGroup.subcommand('server').description('MCP server operations');

  serverGroup
    .subcommand('start')
    .description('Start the Software Metrics Machine MCP stdio server')
    .action(async (_options, command) => {
      // Honor the existing global --debug flag instead of requiring a separate
      // DEBUG env var. When run through the CLI (smm --debug mcp server start)
      // the flag is propagated to all subcommands via optsWithGlobals().
      const { debug } = command.getGlobalOptions();
      if (debug) {
        await startMcpServer({ debug });
        return;
      }

      await startMcpServer();
    });
}
