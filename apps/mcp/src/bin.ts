import { redirectConsoleToStderr } from './mcp-logger';
import { startMcpServer } from './server';

// MCP uses stdout as the JSON-RPC transport. All log output must go to stderr
// so it shows up in the MCP client output panel without corrupting the protocol.
redirectConsoleToStderr();

startMcpServer().catch((error) => {
  process.stderr.write(
    `Failed to start Software Metrics Machine MCP server: ${
      error instanceof Error ? error.message : String(error)
    }\n`
  );
  process.exit(1);
});
