import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const coverageFiles = [
  'packages/utils/coverage/lcov.info',
  'packages/core/coverage/lcov.info',
  'apps/cli/coverage/lcov.info',
  'apps/mcp/coverage/lcov.info',
  'apps/rest/coverage/lcov.info',
  'apps/webapp/coverage/lcov.info',
];

const outputDir = path.join(workspaceRoot, 'coverage');
const outputFile = path.join(outputDir, 'lcov.info');

function parseNumericField(record, fieldName) {
  const match = record.match(new RegExp(`^${fieldName}:(\\d+)$`, 'm'));
  if (!match) {
    return 0;
  }

  return Number(match[1]);
}

function summarizeLcov(lcovContent) {
  const records = lcovContent
    .split('end_of_record')
    .map((record) => record.trim())
    .filter((record) => record.length > 0);

  let linesFound = 0;
  let linesHit = 0;
  let functionsFound = 0;
  let functionsHit = 0;
  let branchesFound = 0;
  let branchesHit = 0;

  for (const record of records) {
    linesFound += parseNumericField(record, 'LF');
    linesHit += parseNumericField(record, 'LH');
    functionsFound += parseNumericField(record, 'FNF');
    functionsHit += parseNumericField(record, 'FNH');
    branchesFound += parseNumericField(record, 'BRF');
    branchesHit += parseNumericField(record, 'BRH');
  }

  const linesPct = linesFound > 0 ? (linesHit / linesFound) * 100 : 0;
  const functionsPct = functionsFound > 0 ? (functionsHit / functionsFound) * 100 : 0;
  const branchesPct = branchesFound > 0 ? (branchesHit / branchesFound) * 100 : 0;

  return {
    files: records.length,
    linesFound,
    linesHit,
    linesPct,
    functionsFound,
    functionsHit,
    functionsPct,
    branchesFound,
    branchesHit,
    branchesPct,
  };
}

const existingFiles = coverageFiles
  .map((relativePath) => ({
    relativePath,
    absolutePath: path.join(workspaceRoot, relativePath),
  }))
  .filter((entry) => fs.existsSync(entry.absolutePath));

if (existingFiles.length === 0) {
  console.error('No coverage files were found. Run `pnpm run coverage:collect` first.');
  process.exit(1);
}

const mergedContent = existingFiles
  .map((entry) => fs.readFileSync(entry.absolutePath, 'utf8').trim())
  .filter((content) => content.length > 0)
  .join('\n\n');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, `${mergedContent}\n`);

const summary = summarizeLcov(mergedContent);

console.log('Merged coverage generated at coverage/lcov.info');
console.log(`Sources merged: ${existingFiles.length}/${coverageFiles.length}`);
console.log(`Files: ${summary.files}`);
console.log(
  `Lines: ${summary.linesHit}/${summary.linesFound} (${summary.linesPct.toFixed(2)}%)`
);
console.log(
  `Functions: ${summary.functionsHit}/${summary.functionsFound} (${summary.functionsPct.toFixed(2)}%)`
);
if (summary.branchesFound > 0) {
  console.log(
    `Branches: ${summary.branchesHit}/${summary.branchesFound} (${summary.branchesPct.toFixed(2)}%)`
  );
} else {
  console.log('Branches: n/a (no branch coverage data reported)');
}

if (existingFiles.length < coverageFiles.length) {
  const missingFiles = coverageFiles.filter(
    (relativePath) => !existingFiles.some((entry) => entry.relativePath === relativePath)
  );

  console.warn('Missing coverage files:');
  for (const missingFile of missingFiles) {
    console.warn(`- ${missingFile}`);
  }
}
