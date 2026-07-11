import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodemaatAnalyzer } from '../../..';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

describe('CodeMaat Analyzer Tests', () => {
  let tempDir: string;
  let analyzer: CodemaatAnalyzer;
  const logger = new MockLoggerBuilder().build();

  beforeAll(() => {
    // Create temporary directory for test CSV files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codemaat-test-'));
    analyzer = new CodemaatAnalyzer(tempDir, logger);
  });

  afterAll(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Code Churn Analysis', () => {
    it('should handle missing churn CSV file', async () => {
      const result = await analyzer.getCodeChurn();

      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should parse valid code churn CSV', async () => {
      const csvContent = `date,added,deleted,commits
2024-01-01,50,10,5
2024-01-02,120,30,8
2024-01-03,75,20,3`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), csvContent);

      const result = await analyzer.getCodeChurn();

      expect(result).toBeDefined();
      expect(result.data.length).toBe(3);
      expect(result.data[0]).toEqual({
        date: '2024-01-01',
        added: 50,
        deleted: 10,
        commits: 5,
      });
    });

    it('should filter churn by date range', async () => {
      const csvContent = `date,added,deleted,commits
2024-01-01,50,10,5
2024-02-01,120,30,8
2024-03-01,75,20,3`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), csvContent);

      const result = await analyzer.getCodeChurn({
        startDate: '2024-02-01',
        endDate: '2024-03-01',
      });

      expect(result.data.length).toBe(2);
      expect(result.data.map((d) => d.date)).toEqual(['2024-02-01', '2024-03-01']);
    });

    it('should handle CSV with quoted values', async () => {
      const csvContent = `date,"added","deleted","commits"
"2024-01-01",50,10,5
"2024-01-02",120,30,8`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), csvContent);

      const result = await analyzer.getCodeChurn();

      expect(result.data.length).toBe(2);
      expect(result.data[0].date).toBe('2024-01-01');
    });

    it('should provide metadata with results', async () => {
      const csvContent = `date,added,deleted,commits
2024-01-01,50,10,5`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), csvContent);

      const result = await analyzer.getCodeChurn({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-12-31');
    });
  });

  describe('File Coupling Analysis', () => {
    it('should handle missing coupling CSV file', async () => {
      const result = await analyzer.getFileCoupling();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should parse valid coupling CSV', async () => {
      const csvContent = `file1,file2,coupling_strength
src/index.ts,src/utils.ts,45
src/api.ts,src/utils.ts,78
src/models.ts,src/database.ts,92`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling();

      expect(result.length).toBe(3);
      expect(result[0]).toEqual({
        entity: 'src/index.ts',
        coupled: 'src/utils.ts',
        degree: 45,
        averageRevs: 0,
      });
    });

    it('should apply ignore patterns', async () => {
      const csvContent = `file1,file2,coupling_strength
src/index.ts,src/utils.ts,45
src/test.js,src/utils.ts,78
dist/build.ts,src/api.ts,92`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({
        ignorePatterns: ['*.js', 'dist/'],
      });

      expect(result.length).toBe(1);
      expect(result[0].entity).toBe('src/index.ts');
    });

    it('should handle ignore patterns with prefix', async () => {
      const csvContent = `file1,file2,coupling_strength
src/index.ts,src/utils.ts,45
test/unit.ts,src/utils.ts,78
node_modules/pkg.ts,src/api.ts,92`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({
        ignorePatterns: ['test/', 'node_modules/'],
      });

      expect(result.length).toBe(1);
    });

    it('should handle CSV with various header formats', async () => {
      const csvContent = `entity1,entity2,strength
src/index.ts,src/utils.ts,45
src/api.ts,src/utils.ts,78`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling();

      expect(result.length).toBe(2);
    });

    it('should parse Code Maat coupling format (entity,coupled,degree)', async () => {
      const csvContent = `entity,coupled,degree,average-revs
src/index.ts,src/utils.ts,45,2
src/api.ts,src/utils.ts,78,5`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling();

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        entity: 'src/index.ts',
        coupled: 'src/utils.ts',
        degree: 45,
        averageRevs: 2,
      });
      expect(result[1]).toEqual({
        entity: 'src/api.ts',
        coupled: 'src/utils.ts',
        degree: 78,
        averageRevs: 5,
      });
    });

    it('should only keep entities matching an includePatterns entry', async () => {
      const csvContent = `entity,coupled,degree
src/index.ts,src/utils.ts,45
docs/readme.md,docs/changelog.md,78`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({
        includePatterns: ['src/'],
      });

      expect(result.length).toBe(1);
      expect(result[0].entity).toBe('src/index.ts');
    });

    it('should not filter by inclusion when includePatterns is empty', async () => {
      const csvContent = `entity,coupled,degree
src/index.ts,src/utils.ts,45
docs/readme.md,docs/changelog.md,78`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({ includePatterns: [] });

      expect(result.length).toBe(2);
    });

    it('should reorder rows by degree descending when sortBy is "degree"', async () => {
      const csvContent = `entity,coupled,degree
src/low.ts,src/utils.ts,10
src/high.ts,src/utils.ts,90
src/mid.ts,src/utils.ts,50`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({ sortBy: 'degree' });

      expect(result.map((row) => row.entity)).toEqual(['src/high.ts', 'src/mid.ts', 'src/low.ts']);
    });

    it('should preserve file order when sortBy is omitted', async () => {
      const csvContent = `entity,coupled,degree
src/low.ts,src/utils.ts,10
src/high.ts,src/utils.ts,90
src/mid.ts,src/utils.ts,50`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling();

      expect(result.map((row) => row.entity)).toEqual(['src/low.ts', 'src/high.ts', 'src/mid.ts']);
    });

    it('should limit results when top is a valid numeric string', async () => {
      const csvContent = `entity,coupled,degree
src/a.ts,src/utils.ts,10
src/b.ts,src/utils.ts,90
src/c.ts,src/utils.ts,50`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({ top: '2' });

      expect(result.length).toBe(2);
    });

    it('should not limit results when top is a non-numeric string', async () => {
      const csvContent = `entity,coupled,degree
src/a.ts,src/utils.ts,10
src/b.ts,src/utils.ts,90
src/c.ts,src/utils.ts,50`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({ top: 'not-a-number' });

      expect(result.length).toBe(3);
    });

    it('should not limit results when top is undefined, null, or an empty string', async () => {
      const csvContent = `entity,coupled,degree
src/a.ts,src/utils.ts,10
src/b.ts,src/utils.ts,90`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const undefinedResult = await analyzer.getFileCoupling({ top: undefined });
      const nullResult = await analyzer.getFileCoupling({ top: null as unknown as undefined });
      const emptyStringResult = await analyzer.getFileCoupling({ top: '' });

      expect(undefinedResult.length).toBe(2);
      expect(nullResult.length).toBe(2);
      expect(emptyStringResult.length).toBe(2);
    });
  });

  describe('Glob Pattern Matching', () => {
    it('should match a "**" pattern across path separators', async () => {
      const csvContent = `entity,coupled,degree
src/nested/dir/utils.ts,other.ts,10
src/other.ts,another.ts,20`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({
        ignorePatterns: ['src/**/utils.ts'],
      });

      expect(result.length).toBe(1);
      expect(result[0].entity).toBe('src/other.ts');
    });

    it('should match a "?" pattern to exactly one non-slash character', async () => {
      const csvContent = `entity,coupled,degree
src/a.ts,other.ts,10
src/ab.ts,other.ts,20`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({
        ignorePatterns: ['src/?.ts'],
      });

      expect(result.length).toBe(1);
      expect(result[0].entity).toBe('src/ab.ts');
    });

    it('should match a glob pattern containing "/" against the full path, not the basename', async () => {
      const csvContent = `entity,coupled,degree
src/foo.test.ts,other.ts,10
other/dir/foo.test.ts,other.ts,20`;

      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), csvContent);

      const result = await analyzer.getFileCoupling({
        ignorePatterns: ['src/*.test.ts'],
      });

      expect(result.length).toBe(1);
      expect(result[0].entity).toBe('other/dir/foo.test.ts');
    });
  });

  describe('Full Analysis', () => {
    beforeAll(() => {
      // Set up test CSV files
      const churnCsv = `date,added,deleted,commits
2024-01-01,50,10,5
2024-01-02,120,30,8`;

      const couplingCsv = `file1,file2,coupling_strength
src/index.ts,src/utils.ts,45
src/api.ts,src/utils.ts,78`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), churnCsv);
      fs.writeFileSync(path.join(tempDir, 'coupling.csv'), couplingCsv);
    });

    it('should run full analysis', async () => {
      const result = await analyzer.analyze();

      expect(result).toBeDefined();
      expect(result.churn).toBeDefined();
      expect(result.coupling).toBeDefined();
      expect(result?.churn?.data.length).toBe(2);
      expect(result?.coupling?.length).toBe(2);
    });

    it('should analyze with date filtering', async () => {
      const result = await analyzer.analyze({
        startDate: '2024-01-02',
        endDate: '2024-01-02',
      });

      expect(result?.churn?.data.length).toBe(1);
      expect(result?.churn?.data[0].date).toBe('2024-01-02');
    });

    it('should analyze with ignore patterns', async () => {
      const result = await analyzer.analyze({
        ignorePatterns: ['*.ts'],
      });

      expect(result?.coupling?.length).toBe(0);
    });
  });

  describe('Code Churn typeChurn Overload', () => {
    beforeAll(() => {
      const csvContent = `date,added,deleted,commits
2024-01-01,50,10,5
2024-01-02,120,30,8`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), csvContent);
    });

    it('should map to added value when typeChurn is "added"', async () => {
      const result = await analyzer.getCodeChurn({ typeChurn: 'added' });

      expect(result.data).toEqual([
        { date: '2024-01-01', type: 'added', value: 50 },
        { date: '2024-01-02', type: 'added', value: 120 },
      ]);
    });

    it('should map to deleted value when typeChurn is "deleted"', async () => {
      const result = await analyzer.getCodeChurn({ typeChurn: 'deleted' });

      expect(result.data).toEqual([
        { date: '2024-01-01', type: 'deleted', value: 10 },
        { date: '2024-01-02', type: 'deleted', value: 30 },
      ]);
    });

    it('should map to commits value when typeChurn is "commits"', async () => {
      const result = await analyzer.getCodeChurn({ typeChurn: 'commits' });

      expect(result.data).toEqual([
        { date: '2024-01-01', type: 'commits', value: 5 },
        { date: '2024-01-02', type: 'commits', value: 8 },
      ]);
    });

    it('should default to added+deleted total for an unrecognized typeChurn value', async () => {
      const result = await analyzer.getCodeChurn({ typeChurn: 'bogus' });

      expect(result.data).toEqual([
        { date: '2024-01-01', type: 'bogus', value: 60 },
        { date: '2024-01-02', type: 'bogus', value: 150 },
      ]);
    });

    it('should default to added+deleted total when typeChurn key is present but undefined', async () => {
      const result = await analyzer.getCodeChurn({ typeChurn: undefined });

      expect(result.data).toEqual([
        { date: '2024-01-01', type: 'total', value: 60 },
        { date: '2024-01-02', type: 'total', value: 150 },
      ]);
    });

    it('should return the plain (non-mapped) shape when no options are passed', async () => {
      const result = await analyzer.getCodeChurn();

      expect(result.data).toEqual([
        { date: '2024-01-01', added: 50, deleted: 10, commits: 5 },
        { date: '2024-01-02', added: 120, deleted: 30, commits: 8 },
      ]);
    });

    it('should return the plain (non-mapped) shape when options omit the typeChurn key', async () => {
      const result = await analyzer.getCodeChurn({ startDate: '2024-01-01' });

      expect(result.data).toEqual([
        { date: '2024-01-01', added: 50, deleted: 10, commits: 5 },
        { date: '2024-01-02', added: 120, deleted: 30, commits: 8 },
      ]);
    });
  });

  describe('Entity Churn Analysis', () => {
    it('should parse a valid entity-churn CSV', async () => {
      const csvContent = `entity,added,deleted,commits
src/index.ts,50,10,5
src/utils.ts,20,5,2`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn();

      expect(result).toEqual([
        { entity: 'src/index.ts', added: 50, deleted: 10, commits: 5 },
        { entity: 'src/utils.ts', added: 20, deleted: 5, commits: 2 },
      ]);
    });

    it('should exclude rows with a blank entity', async () => {
      const csvContent = `entity,added,deleted,commits
src/index.ts,50,10,5
,20,5,2`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn();

      expect(result).toEqual([{ entity: 'src/index.ts', added: 50, deleted: 10, commits: 5 }]);
    });

    it('should exclude an entity matching an ignorePatterns entry', async () => {
      const csvContent = `entity,added,deleted,commits
src/index.ts,50,10,5
dist/bundle.js,20,5,2`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn({ ignorePatterns: ['dist/'] });

      expect(result).toEqual([{ entity: 'src/index.ts', added: 50, deleted: 10, commits: 5 }]);
    });

    it('should only keep an entity matching an includePatterns entry', async () => {
      const csvContent = `entity,added,deleted,commits
src/index.ts,50,10,5
docs/readme.md,20,5,2`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn({ includePatterns: ['src/'] });

      expect(result).toEqual([{ entity: 'src/index.ts', added: 50, deleted: 10, commits: 5 }]);
    });

    it('should sort rows by added+deleted descending', async () => {
      const csvContent = `entity,added,deleted,commits
src/small.ts,1,1,1
src/big.ts,50,40,9
src/medium.ts,10,5,3`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn();

      expect(result.map((row) => row.entity)).toEqual([
        'src/big.ts',
        'src/medium.ts',
        'src/small.ts',
      ]);
    });

    it('should limit results when top is provided', async () => {
      const csvContent = `entity,added,deleted,commits
src/small.ts,1,1,1
src/big.ts,50,40,9
src/medium.ts,10,5,3`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn({ top: 2 });

      expect(result.map((row) => row.entity)).toEqual(['src/big.ts', 'src/medium.ts']);
    });

    it('should parse a semicolon-delimited entity-churn CSV', async () => {
      const csvContent = `entity;added;deleted;commits
src/index.ts;50;10;5`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn();

      expect(result).toEqual([{ entity: 'src/index.ts', added: 50, deleted: 10, commits: 5 }]);
    });

    it('should default missing trailing values to empty string when a row has fewer columns than the header', async () => {
      const csvContent = `entity,added,deleted,commits
src/index.ts,50`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn();

      expect(result).toEqual([{ entity: 'src/index.ts', added: 50, deleted: 0, commits: 0 }]);
    });

    it('should fall back to 0 when a numeric column contains a non-numeric value', async () => {
      const csvContent = `entity,added,deleted,commits
src/index.ts,N/A,10,5`;

      fs.writeFileSync(path.join(tempDir, 'entity-churn.csv'), csvContent);

      const result = await analyzer.getEntityChurn();

      expect(result).toEqual([{ entity: 'src/index.ts', added: 0, deleted: 10, commits: 5 }]);
    });
  });

  describe('Entity Effort Analysis', () => {
    it('should parse total-revs from the "total-revs" header', async () => {
      const csvContent = `entity,total-revs
src/index.ts,12
src/utils.ts,5`;

      fs.writeFileSync(path.join(tempDir, 'entity-effort.csv'), csvContent);

      const result = await analyzer.getEntityEffort();

      expect(result).toEqual([
        { entity: 'src/index.ts', 'total-revs': 12 },
        { entity: 'src/utils.ts', 'total-revs': 5 },
      ]);
    });

    it('should fall back to the "total_revs" header when "total-revs" is absent', async () => {
      const csvContent = `entity,total_revs
src/index.ts,7
src/utils.ts,3`;

      fs.writeFileSync(path.join(tempDir, 'entity-effort.csv'), csvContent);

      const result = await analyzer.getEntityEffort();

      expect(result).toEqual([
        { entity: 'src/index.ts', 'total-revs': 7 },
        { entity: 'src/utils.ts', 'total-revs': 3 },
      ]);
    });

    it('should fall back to the "revs" header when neither "total-revs" nor "total_revs" is present', async () => {
      const csvContent = `entity,revs
src/index.ts,9
src/utils.ts,4`;

      fs.writeFileSync(path.join(tempDir, 'entity-effort.csv'), csvContent);

      const result = await analyzer.getEntityEffort();

      expect(result).toEqual([
        { entity: 'src/index.ts', 'total-revs': 9 },
        { entity: 'src/utils.ts', 'total-revs': 4 },
      ]);
    });

    it('should sort rows by total-revs descending', async () => {
      const csvContent = `entity,total-revs
src/small.ts,1
src/big.ts,50
src/medium.ts,10`;

      fs.writeFileSync(path.join(tempDir, 'entity-effort.csv'), csvContent);

      const result = await analyzer.getEntityEffort();

      expect(result.map((row) => row.entity)).toEqual([
        'src/big.ts',
        'src/medium.ts',
        'src/small.ts',
      ]);
    });

    it('should collapse author-expanded rows into one effort row per entity', async () => {
      const csvContent = `entity,author,author-revs,total-revs
src/shared.ts,Alice,3,5
src/shared.ts,Bob,2,5
src/big.ts,Alice,7,7
src/small.ts,Carol,1,1`;

      fs.writeFileSync(path.join(tempDir, 'entity-effort.csv'), csvContent);

      const result = await analyzer.getEntityEffort({ top: 2 });

      expect(result).toEqual([
        { entity: 'src/big.ts', 'total-revs': 7 },
        { entity: 'src/shared.ts', 'total-revs': 5 },
      ]);
    });
  });

  describe('Entity Ownership Analysis', () => {
    it('should return deduped, alphabetically-sorted authors when select is "authors"', async () => {
      const csvContent = `entity,author,added,deleted
src/index.ts,Bob,10,2
src/utils.ts,Alice,5,1
src/api.ts,Bob,3,1`;

      fs.writeFileSync(path.join(tempDir, 'entity-ownership.csv'), csvContent);

      const result = await analyzer.getEntityOwnership({ select: 'authors' });

      expect(result).toEqual(['Alice', 'Bob']);
    });

    it('should filter rows by authors case-insensitively', async () => {
      const csvContent = `entity,author,added,deleted
src/index.ts,Bob,10,2
src/utils.ts,Alice,5,1`;

      fs.writeFileSync(path.join(tempDir, 'entity-ownership.csv'), csvContent);

      const result = await analyzer.getEntityOwnership({ authors: 'ALICE' });

      expect(result).toEqual([{ entity: 'src/utils.ts', author: 'Alice', added: 5, deleted: 1 }]);
    });

    it('should return rows sorted by added+deleted descending and apply top limiting when select is omitted', async () => {
      const csvContent = `entity,author,added,deleted
src/small.ts,Alice,1,1
src/big.ts,Bob,50,40
src/medium.ts,Carol,10,5`;

      fs.writeFileSync(path.join(tempDir, 'entity-ownership.csv'), csvContent);

      const result = await analyzer.getEntityOwnership({ top: 2 });

      expect(result).toEqual([
        { entity: 'src/big.ts', author: 'Bob', added: 50, deleted: 40 },
        { entity: 'src/medium.ts', author: 'Carol', added: 10, deleted: 5 },
      ]);
    });

    it('should exclude rows with a blank entity or blank author', async () => {
      const csvContent = `entity,author,added,deleted
src/index.ts,Bob,10,2
,Alice,5,1
src/utils.ts,,3,1`;

      fs.writeFileSync(path.join(tempDir, 'entity-ownership.csv'), csvContent);

      const result = await analyzer.getEntityOwnership();

      expect(result).toEqual([{ entity: 'src/index.ts', author: 'Bob', added: 10, deleted: 2 }]);
    });
  });

  describe('Error Handling', () => {
    it('should handle directory with no CSV files', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codemaat-empty-'));
      const emptyAnalyzer = new CodemaatAnalyzer(emptyDir, logger);

      try {
        const churn = await emptyAnalyzer.getCodeChurn();
        const coupling = await emptyAnalyzer.getFileCoupling();

        expect(churn.data.length).toBe(0);
        expect(coupling.length).toBe(0);
      } finally {
        if (fs.existsSync(emptyDir)) {
          fs.rmSync(emptyDir, { recursive: true });
        }
      }
    });

    it('should handle malformed CSV gracefully', async () => {
      const malformedCsv = `this,is,broken
missing,columns`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), malformedCsv);

      const result = await analyzer.getCodeChurn();

      // Should return empty data for malformed CSV
      expect(result.data.length).toBe(0);
    });

    it('should skip malformed CSV rows', async () => {
      const csvContent = `date,added,deleted,commits
2024-01-01,50,10,5
broken,row,here
2024-01-02,120,30,8`;

      fs.writeFileSync(path.join(tempDir, 'abs-churn.csv'), csvContent);

      const result = await analyzer.getCodeChurn();

      // Should parse valid rows and skip malformed ones
      expect(result.data.length).toBe(2);
      expect(result.data[0].date).toBe('2024-01-01');
      expect(result.data[1].date).toBe('2024-01-02');
    });
  });
});
