import { redirectConsoleToStderr } from './mcp-logger';
import { startMcpServer } from './server';

redirectConsoleToStderr();

startMcpServer().catch((error) => {
  process.stderr.write(
    `Failed to start Software Metrics Machine MCP server: ${
      error instanceof Error ? error.message : String(error)
    }\n`
  );
  process.exit(1);
});
