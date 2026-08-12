import { Chalk } from 'chalk';

export class Screen {
  private readonly chalk = new Chalk({ level: process.stdout.isTTY ? 1 : 0 });

  printLine(message = ''): void {
    // Centralized console boundary for CLI user-facing output.
    // eslint-disable-next-line no-console
    console.log(this.format(message));
  }

  private format(message: string): string {
    if (!message || this.isJson(message)) return message;

    const heading = message.match(/^(\n?)(=== .+ ===)(\n?)$/);
    if (heading) {
      return `${heading[1]}${this.chalk.bold.cyan(heading[2])}${heading[3]}`;
    }

    if (message.startsWith('✅')) return this.chalk.green(message);
    if (message.startsWith('❌')) return this.chalk.red(message);
    if (message.startsWith('⚠️')) return this.chalk.yellow(message);
    if (message.startsWith('🔄') || message.startsWith('🔍') || message.startsWith('📊')) {
      return this.chalk.cyan(message);
    }

    const label = message.match(/^(\s*)([^:\n]+):(\s+.+)$/);
    if (label) {
      return `${label[1]}${this.chalk.bold(label[2])}:${label[3]}`;
    }

    return message;
  }

  private isJson(message: string): boolean {
    const trimmedMessage = message.trim();
    return (
      (trimmedMessage.startsWith('{') && trimmedMessage.endsWith('}')) ||
      (trimmedMessage.startsWith('[') && trimmedMessage.endsWith(']'))
    );
  }
}
