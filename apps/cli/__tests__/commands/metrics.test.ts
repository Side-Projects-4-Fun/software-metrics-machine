import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '../../src';

function idsOf(value: unknown): string[] {
  return (value as Array<{ id: string }>).map((entry) => entry.id);
}

describe('cli: Metrics Commands', () => {
  let program: ReturnType<typeof commands>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const getOutput = (): string =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });
    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('lists every metric by default', async () => {
    await program.parseAsync(['metrics', 'list'], { from: 'user' });

    const output = getOutput();

    expect(output).toContain('cr-summary (cr) - Change request summary');
    expect(output).toContain('cr-label-summary (cr) - Change request labels');
    expect(output).toContain('Total: 86');
  });

  it('filters by public visibility', async () => {
    await program.parseAsync(['metrics', 'list', '--visibility', 'public'], { from: 'user' });

    const output = getOutput();

    expect(output).toContain('Total: 78');
    expect(output).not.toContain('cr-label-summary');
  });

  it('filters by namespace', async () => {
    await program.parseAsync(['metrics', 'list', '--namespace', 'eh'], { from: 'user' });

    const output = getOutput();

    expect(output).toContain('deployment-frequency (eh) - Deployment frequency');
    expect(output).toContain('Total: 14');
    expect(output).not.toContain('cr-summary');
  });

  it('includes internal metrics when requested', async () => {
    await program.parseAsync(['metrics', 'list', '--visibility', 'internal'], { from: 'user' });

    const output = getOutput();

    expect(output).toContain('cr-label-summary (cr) - Change request labels');
    expect(output).toContain('Total: 8');
  });

  it('prints json output', async () => {
    await program.parseAsync(
      ['metrics', 'list', '--output', 'json', '--visibility', 'internal', '--namespace', 'issue'],
      { from: 'user' }
    );

    expect(idsOf(JSON.parse(getOutput()))).toEqual(['issue-list']);
  });

  it('rejects an unknown namespace', async () => {
    await expect(
      program.parseAsync(['metrics', 'list', '--namespace', 'nope'], { from: 'user' })
    ).rejects.toThrow('process.exit(1)');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('rejects an unknown visibility', async () => {
    await expect(
      program.parseAsync(['metrics', 'list', '--visibility', 'private'], { from: 'user' })
    ).rejects.toThrow('process.exit(1)');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
