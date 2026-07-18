import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';

const mocks = vi.hoisted(() => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    readdirSync: mocks.readdirSync,
    readFileSync: mocks.readFileSync,
    writeFileSync: mocks.writeFileSync,
  };
});

describe('cli: Tools Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

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

    mocks.readdirSync.mockReturnValue([]);
    mocks.readFileSync.mockReturnValue('{}');
    mocks.writeFileSync.mockImplementation(() => undefined);

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
    vi.unstubAllEnvs();
  });

  describe('tools json-merge', () => {
    it('lists inputs from the current directory via fs.readdirSync', async () => {
      mocks.readdirSync.mockReturnValue(['a.json', 'b.json']);
      mocks.readFileSync.mockImplementation((file: unknown) =>
        file === 'a.json' ? '{"a":1}' : '{"b":2}'
      );

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json'], { from: 'user' });

      expect(mocks.readdirSync).toHaveBeenCalledWith('.');
    });

    it('reads each input file via fs.readFileSync and writes the merged object', async () => {
      mocks.readdirSync.mockReturnValue(['a.json', 'b.json']);
      mocks.readFileSync.mockImplementation((file: unknown) =>
        file === 'a.json' ? '{"a":1}' : '{"b":2}'
      );

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json'], { from: 'user' });

      expect(mocks.readFileSync).toHaveBeenCalledWith('a.json', 'utf-8');
      expect(mocks.readFileSync).toHaveBeenCalledWith('b.json', 'utf-8');
      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        'out.json',
        JSON.stringify({ a: 1, b: 2 }),
        'utf-8'
      );
    });

    it('excludes the output file from the input list', async () => {
      mocks.readdirSync.mockReturnValue(['out.json', 'a.json']);
      mocks.readFileSync.mockImplementation((file: unknown) =>
        file === 'out.json' ? '{"existing":true}' : '{"a":1}'
      );

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json'], { from: 'user' });

      expect(mocks.readFileSync).not.toHaveBeenCalledWith('out.json', 'utf-8');
      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        'out.json',
        JSON.stringify({ a: 1 }),
        'utf-8'
      );
    });

    it('concatenates array JSON files into a single array', async () => {
      mocks.readdirSync.mockReturnValue(['a.json', 'b.json']);
      mocks.readFileSync.mockImplementation((file: unknown) =>
        file === 'a.json' ? '[1,2]' : '[3,4]'
      );

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json'], { from: 'user' });

      expect(mocks.writeFileSync).toHaveBeenCalledWith('out.json', '[1,2,3,4]', 'utf-8');
    });

    it('writes pretty-printed output when --pretty is provided', async () => {
      mocks.readdirSync.mockReturnValue(['a.json']);
      mocks.readFileSync.mockReturnValue('{"a":1}');

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json', '--pretty'], {
        from: 'user',
      });

      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        'out.json',
        JSON.stringify({ a: 1 }, null, 2),
        'utf-8'
      );
    });

    it('writes compact output by default', async () => {
      mocks.readdirSync.mockReturnValue(['a.json']);
      mocks.readFileSync.mockReturnValue('{"a":1}');

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json'], { from: 'user' });

      expect(mocks.writeFileSync).toHaveBeenCalledWith('out.json', '{"a":1}', 'utf-8');
    });

    it('does not write an output file when no JSON files are found', async () => {
      mocks.readdirSync.mockReturnValue([]);

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json'], { from: 'user' });

      expect(mocks.writeFileSync).not.toHaveBeenCalled();
      expect(getOutput()).toContain('⚠️  No JSON files found matching pattern: *.json');
    });

    it('reports the input pattern in the warning when --input is provided', async () => {
      mocks.readdirSync.mockReturnValue([]);

      await program.parseAsync(
        ['tools', 'json-merge', '--input', 'data/*.json', '--output', 'out.json'],
        { from: 'user' }
      );

      expect(getOutput()).toContain('No JSON files found matching pattern: data/*.json');
    });

    it('defaults the output file to merged.json when --output is omitted', async () => {
      mocks.readdirSync.mockReturnValue(['a.json']);
      mocks.readFileSync.mockReturnValue('{"a":1}');

      await program.parseAsync(['tools', 'json-merge'], { from: 'user' });

      expect(mocks.writeFileSync).toHaveBeenCalledWith('merged.json', '{"a":1}', 'utf-8');
    });

    it('prints per-file merge status and final summary', async () => {
      mocks.readdirSync.mockReturnValue(['a.json', 'b.json']);
      mocks.readFileSync.mockImplementation((file: unknown) =>
        file === 'a.json' ? '{"a":1}' : '{"b":2}'
      );

      await program.parseAsync(['tools', 'json-merge', '--output', 'out.json'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('🔄 Merging JSON files...');
      expect(output).toContain('📁 Found 2 JSON files to merge');
      expect(output).toContain('✅ Merged: a.json');
      expect(output).toContain('✅ Merged: b.json');
      expect(output).toContain('✅ Merged JSON saved to: out.json');
      expect(output).toContain('Total items: 2');
    });
  });
});
