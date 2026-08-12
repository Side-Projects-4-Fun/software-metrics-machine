import { Chalk } from 'chalk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Screen } from '../src/screen';

describe('Screen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps JSON output unchanged', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    new Screen().printLine('{\n  "total": 3\n}');

    expect(logSpy).toHaveBeenCalledWith('{\n  "total": 3\n}');
  });

  it('formats headings for interactive terminals', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const screen = new Screen();
    Object.defineProperty(screen, 'chalk', {
      value: new Chalk({ level: 1 }),
    });

    screen.printLine('=== Pipeline Summary ===');

    expect(logSpy).toHaveBeenCalledWith(
      new Chalk({ level: 1 }).bold.cyan('=== Pipeline Summary ===')
    );
  });

  it('renders semantic key-value output for interactive terminals', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const screen = new Screen();
    const chalk = new Chalk({ level: 1 });
    Object.defineProperty(screen, 'chalk', { value: chalk });

    screen.keyValue('Total runs', 42);

    expect(logSpy).toHaveBeenCalledWith(`${chalk.bold('Total runs')}: 42`);
  });

  it('renders success messages', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    new Screen().success('Data fetched');

    expect(logSpy).toHaveBeenCalledWith('✅ Data fetched');
  });
});
