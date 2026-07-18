#!/usr/bin/env bash
set -uo pipefail

SMM_E2E_STATUS=0
SMM_E2E_OUTPUT=''
SMM_E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMM_REPO_ROOT="$(cd "${SMM_E2E_DIR}/../../.." && pwd)"

run_smm() {
  SMM_E2E_OUTPUT="$("${SMM_CLI_BIN}" "$@" 2>&1)"
  SMM_E2E_STATUS=$?
  return 0
}

assert_smm_equals() {
  local expected="$1"
  local actual="$2"

  if declare -F assert_equals >/dev/null 2>&1; then
    assert_equals "${expected}" "${actual}"
    return
  fi

  [[ "${expected}" == "${actual}" ]]
}

assert_smm_success() {
  assert_smm_equals "0" "${SMM_E2E_STATUS}"
}

assert_smm_failure() {
  if [[ "${SMM_E2E_STATUS}" -eq 0 ]]; then
    assert_smm_equals "non-zero exit status" "0"
  fi
}

assert_smm_output_contains() {
  local expected="$1"

  if [[ "${SMM_E2E_OUTPUT}" == *"${expected}"* ]]; then
    assert_smm_equals "${expected}" "${expected}"
    return
  fi

  assert_smm_equals "${expected}" "${SMM_E2E_OUTPUT}"
}

assert_smm_output_not_contains() {
  local unexpected="$1"

  if [[ "${SMM_E2E_OUTPUT}" != *"${unexpected}"* ]]; then
    assert_smm_equals "output without ${unexpected}" "output without ${unexpected}"
    return
  fi

  assert_smm_equals "output without ${unexpected}" "${SMM_E2E_OUTPUT}"
}

assert_smm_file_exists() {
  local file_path="$1"

  if [[ -f "${file_path}" ]]; then
    assert_smm_equals "${file_path}" "${file_path}"
    return
  fi

  assert_smm_equals "existing file ${file_path}" "missing file ${file_path}"
}

assert_smm_file_contains() {
  local file_path="$1"
  local expected="$2"
  local content=''

  if [[ -f "${file_path}" ]]; then
    content="$(<"${file_path}")"
  fi

  if [[ "${content}" == *"${expected}"* ]]; then
    assert_smm_equals "${expected}" "${expected}"
    return
  fi

  assert_smm_equals "${expected}" "${content}"
}

create_smm_e2e_workspace() {
  local workspace
  local tmp_root="${SMM_REPO_ROOT}/tmp/e2e"

  mkdir -p "${tmp_root}"
  workspace="$(mktemp -d "${tmp_root}/smm-cli-e2e.XXXXXX")"
  mkdir -p "${workspace}/repo"

  cat >"${workspace}/smm_config.json" <<JSON
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "test-token",
      "github_repository": "acme/widgets",
      "git_repository_location": "${workspace}/repo",
      "log_level": "DEBUG"
    }
  ]
}
JSON

  printf '%s\n' "${workspace}"
}

run_smm_with_github_prs_msw() {
  SMM_E2E_OUTPUT="$(node "${SMM_E2E_DIR}/support/github-prs-msw-runner.mjs" "$@" 2>&1)"
  SMM_E2E_STATUS=$?
  return 0
}

seed_sqlite_fixture() {
  local workspace="$1"
  local fixture="$2"

  node - "${workspace}" "${fixture}" <<'NODE'
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const [workspace, fixture] = process.argv.slice(2);
const projectDir = path.join(workspace, 'github_acme_widgets');
const dbPath = path.join(projectDir, 'smm.sqlite');
fs.mkdirSync(projectDir, { recursive: true });

const db = new DatabaseSync(dbPath);

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repository_records (
      namespace TEXT NOT NULL,
      record_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (namespace, record_key)
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      namespace TEXT NOT NULL,
      id TEXT NOT NULL,
      run_number INTEGER,
      name TEXT,
      path TEXT,
      event TEXT,
      status TEXT,
      conclusion TEXT,
      head_branch TEXT,
      created_at TEXT,
      updated_at TEXT,
      run_started_at TEXT,
      run_attempt INTEGER,
      payload TEXT NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      PRIMARY KEY (namespace, id)
    );

    CREATE TABLE IF NOT EXISTS workflow_jobs (
      namespace TEXT NOT NULL,
      id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      name TEXT,
      status TEXT,
      conclusion TEXT,
      started_at TEXT,
      completed_at TEXT,
      payload TEXT NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      PRIMARY KEY (namespace, id)
    );

    CREATE TABLE IF NOT EXISTS commits (
      namespace TEXT NOT NULL,
      hash TEXT NOT NULL,
      author TEXT,
      email TEXT,
      msg TEXT,
      subject TEXT,
      timestamp TEXT,
      co_authors_json TEXT,
      files_json TEXT,
      payload TEXT NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      PRIMARY KEY (namespace, hash)
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      namespace TEXT NOT NULL,
      id TEXT NOT NULL,
      number INTEGER,
      state TEXT,
      title TEXT,
      author_login TEXT,
      author_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      closed_at TEXT,
      merged_at TEXT,
      html_url TEXT,
      payload TEXT NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      PRIMARY KEY (namespace, id)
    );

    CREATE TABLE IF NOT EXISTS pull_request_comments (
      namespace TEXT NOT NULL,
      id TEXT NOT NULL,
      pull_request_number INTEGER,
      pull_request_url TEXT,
      author_login TEXT,
      author_id TEXT,
      path TEXT,
      created_at TEXT,
      updated_at TEXT,
      html_url TEXT,
      payload TEXT NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      PRIMARY KEY (namespace, id)
    );

    CREATE TABLE IF NOT EXISTS codemaat_code_churn (
      date TEXT NOT NULL,
      added INTEGER NOT NULL,
      deleted INTEGER NOT NULL,
      commits INTEGER NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      fetched_at TEXT,
      PRIMARY KEY (date, position)
    );

    CREATE TABLE IF NOT EXISTS codemaat_file_coupling (
      entity TEXT NOT NULL,
      coupled TEXT NOT NULL,
      degree INTEGER NOT NULL,
      average_revs INTEGER,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      fetched_at TEXT,
      PRIMARY KEY (entity, coupled, position)
    );

    CREATE TABLE IF NOT EXISTS codemaat_entity_churn (
      entity TEXT NOT NULL,
      added INTEGER NOT NULL,
      deleted INTEGER NOT NULL,
      commits INTEGER NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      fetched_at TEXT,
      PRIMARY KEY (entity, position)
    );

    CREATE TABLE IF NOT EXISTS codemaat_entity_effort (
      entity TEXT NOT NULL,
      total_revs INTEGER NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      fetched_at TEXT,
      PRIMARY KEY (entity, position)
    );

    CREATE TABLE IF NOT EXISTS codemaat_entity_ownership (
      entity TEXT NOT NULL,
      author TEXT NOT NULL,
      added INTEGER NOT NULL,
      deleted INTEGER NOT NULL,
      position INTEGER NOT NULL,
      stored_at TEXT NOT NULL,
      fetched_at TEXT,
      PRIMARY KEY (entity, author, position)
    );
  `);
}

function clearNamespaces(namespaces) {
  const tables = ['repository_records', 'workflow_runs', 'workflow_jobs', 'commits', 'pull_requests', 'pull_request_comments'];
  for (const table of tables) {
    for (const namespace of namespaces) {
      db.prepare(`DELETE FROM ${table} WHERE namespace = ?`).run(namespace);
    }
  }
}

function seedPrs() {
  const namespacePrs = 'github/prs.json';
  const namespaceComments = 'github/pr-comments.json';
  clearNamespaces([namespacePrs, namespaceComments]);
  const storedAt = new Date().toISOString();

  const prs = [
    {
      id: 101,
      number: 7,
      state: 'closed',
      title: 'Add checkout flow',
      body: 'Checkout metrics implementation',
      user: { id: 501, login: 'alice' },
      labels: [{ id: 1, name: 'feature', color: '0e8a16' }],
      created_at: '2026-01-05T09:00:00Z',
      updated_at: '2026-01-06T09:00:00Z',
      closed_at: '2026-01-07T09:00:00Z',
      merged_at: '2026-01-07T09:00:00Z',
      html_url: 'https://github.com/acme/widgets/pull/7',
    },
    {
      id: 102,
      number: 8,
      state: 'open',
      title: 'Refine cart metrics',
      body: 'Cart analytics improvements',
      user: { id: 502, login: 'bob' },
      labels: [{ id: 2, name: 'analytics', color: '5319e7' }],
      created_at: '2026-01-12T09:00:00Z',
      updated_at: '2026-01-12T11:00:00Z',
      html_url: 'https://github.com/acme/widgets/pull/8',
    },
  ];

  const insertPr = db.prepare(`
    INSERT INTO pull_requests
    (namespace, id, number, state, title, author_login, author_id, created_at, updated_at, closed_at, merged_at, html_url, payload, position, stored_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  prs.forEach((pr, index) => {
    insertPr.run(
      namespacePrs,
      String(pr.id),
      pr.number,
      pr.state,
      pr.title,
      pr.user.login,
      String(pr.user.id),
      pr.created_at,
      pr.updated_at,
      pr.closed_at || null,
      pr.merged_at || null,
      pr.html_url,
      JSON.stringify(pr),
      index,
      storedAt
    );
  });

  const comment = {
    id: 9001,
    url: 'https://api.github.com/repos/acme/widgets/pulls/comments/9001',
    pull_request_url: 'https://api.github.com/repos/acme/widgets/pulls/7',
    body: 'Please add a checkout regression test.',
    user: { id: 601, login: 'reviewer' },
    path: 'src/cart.ts',
    created_at: '2026-01-05T13:00:00Z',
    updated_at: '2026-01-05T13:05:00Z',
    html_url: 'https://github.com/acme/widgets/pull/7#discussion_r9001',
  };

  db.prepare(`
    INSERT INTO pull_request_comments
    (namespace, id, pull_request_number, pull_request_url, author_login, author_id, path, created_at, updated_at, html_url, payload, position, stored_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    namespaceComments,
    String(comment.id),
    7,
    comment.pull_request_url,
    comment.user.login,
    String(comment.user.id),
    comment.path,
    comment.created_at,
    comment.updated_at,
    comment.html_url,
    JSON.stringify(comment),
    0,
    storedAt
  );
}

function seedPipelines() {
  const runsNs = 'github/pipeline-runs';
  const jobsNs = 'github/pipeline-jobs';
  clearNamespaces([runsNs, jobsNs]);
  const storedAt = new Date().toISOString();

  const runs = [
    {
      id: '2001',
      name: 'Deploy',
      path: '.github/workflows/deploy.yml',
      run_number: 41,
      event: 'push',
      status: 'completed',
      conclusion: 'success',
      head_branch: 'main',
      created_at: '2026-02-03T10:00:00Z',
      updated_at: '2026-02-03T10:10:00Z',
      run_started_at: '2026-02-03T10:00:00Z',
      run_attempt: 1,
      html_url: 'https://github.com/acme/widgets/actions/runs/2001',
    },
    {
      id: '2002',
      name: 'Deploy',
      path: '.github/workflows/deploy.yml',
      run_number: 42,
      event: 'push',
      status: 'completed',
      conclusion: 'failure',
      head_branch: 'main',
      created_at: '2026-02-04T11:00:00Z',
      updated_at: '2026-02-04T11:20:00Z',
      run_started_at: '2026-02-04T11:00:00Z',
      run_attempt: 2,
      html_url: 'https://github.com/acme/widgets/actions/runs/2002',
    },
  ];

  const insertRun = db.prepare(`
    INSERT INTO workflow_runs
    (namespace, id, run_number, name, path, event, status, conclusion, head_branch, created_at, updated_at, run_started_at, run_attempt, payload, position, stored_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  runs.forEach((run, index) => {
    insertRun.run(
      runsNs,
      run.id,
      run.run_number,
      run.name,
      run.path,
      run.event,
      run.status,
      run.conclusion,
      run.head_branch,
      run.created_at,
      run.updated_at,
      run.run_started_at,
      run.run_attempt,
      JSON.stringify(run),
      index,
      storedAt
    );
  });

  const jobs = [
    {
      id: '5001',
      run_id: '2001',
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-02-03T10:00:00Z',
      completed_at: '2026-02-03T10:05:00Z',
      steps: [
        { name: 'Checkout', started_at: '2026-02-03T10:00:00Z', completed_at: '2026-02-03T10:02:00Z', status: 'completed', conclusion: 'success' },
        { name: 'Test', started_at: '2026-02-03T10:02:00Z', completed_at: '2026-02-03T10:05:00Z', status: 'completed', conclusion: 'success' },
      ],
    },
    {
      id: '5002',
      run_id: '2001',
      name: 'deploy',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-02-03T10:05:00Z',
      completed_at: '2026-02-03T10:10:00Z',
      steps: [{ name: 'Release', started_at: '2026-02-03T10:05:00Z', completed_at: '2026-02-03T10:10:00Z', status: 'completed', conclusion: 'success' }],
    },
    {
      id: '5003',
      run_id: '2002',
      name: 'build',
      status: 'completed',
      conclusion: 'failure',
      started_at: '2026-02-04T11:00:00Z',
      completed_at: '2026-02-04T11:20:00Z',
      steps: [
        { name: 'Checkout', started_at: '2026-02-04T11:00:00Z', completed_at: '2026-02-04T11:05:00Z', status: 'completed', conclusion: 'success' },
        { name: 'Test', started_at: '2026-02-04T11:05:00Z', completed_at: '2026-02-04T11:20:00Z', status: 'completed', conclusion: 'failure' },
      ],
    },
  ];

  const insertJob = db.prepare(`
    INSERT INTO workflow_jobs
    (namespace, id, run_id, name, status, conclusion, started_at, completed_at, payload, position, stored_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  jobs.forEach((job, index) => {
    insertJob.run(
      jobsNs,
      job.id,
      job.run_id,
      job.name,
      job.status,
      job.conclusion,
      job.started_at,
      job.completed_at,
      JSON.stringify(job),
      index,
      storedAt
    );
  });
}

function seedJira() {
  const ns = 'jira/issues.json';
  clearNamespaces([ns]);
  const updatedAt = new Date().toISOString();
  const issues = [
    { id: 'KAN-123', key: 'KAN-123', status: 'In Progress', title: 'Add checkout metrics', createdAt: '2026-01-09T12:00:00Z' },
    { id: 'KAN-456', key: 'KAN-456', status: 'Done', title: 'Refine cart logic', createdAt: '2026-01-10T09:00:00Z' },
    { id: 'KAN-789', key: 'KAN-789', status: 'To Do', title: 'Implement payment gateway', createdAt: '2026-01-11T14:00:00Z' },
  ];
  const insert = db.prepare(`
    INSERT INTO repository_records
    (namespace, record_key, payload, position, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  issues.forEach((issue, index) => {
    insert.run(ns, String(index), JSON.stringify(issue), index, updatedAt);
  });
}

function seedArchitecture() {
  const ns = 'architecture/snapshots.json';
  clearNamespaces([ns]);
  const updatedAt = new Date().toISOString();
  const payload = [
    {
      snapshotId: 'snap-1',
      project: 'acme/widgets',
      generatedAt: '2026-01-15T10:00:00Z',
      commitCount: 42,
      views: [
        {
          id: 'container-view',
          level: 'container',
          title: 'Container View',
          nodes: [
            { id: 'webapp', kind: 'container', name: 'Web Application', technology: 'Next.js' },
            { id: 'api', kind: 'container', name: 'REST API', technology: 'NestJS' },
          ],
          edges: [{ id: 'e1', source: 'webapp', target: 'api', kind: 'uses', description: 'HTTP', confidence: 1 }],
        },
        {
          id: 'context-view',
          level: 'context',
          title: 'Context View',
          nodes: [
            { id: 'developer', kind: 'person', name: 'Developer' },
            { id: 'system', kind: 'system', name: 'Software Metrics Machine' },
          ],
          edges: [],
        },
      ],
    },
  ];
  db.prepare(`
    INSERT INTO repository_records
    (namespace, record_key, payload, position, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(ns, '__singleton__', JSON.stringify(payload), 0, updatedAt);
}

function seedCodeAnalysis() {
  const commitsNs = 'git/commits.json';
  clearNamespaces([commitsNs]);
  const storedAt = new Date().toISOString();

  const commits = [
    {
      hash: '1111111111111111111111111111111111111111',
      author: 'Alice',
      email: 'alice@example.com',
      subject: 'Pair on cart flow',
      timestamp: '2026-03-03T10:00:00Z',
      coAuthors: ['Bob'],
      files: ['src/cart.ts'],
    },
    {
      hash: '2222222222222222222222222222222222222222',
      author: 'Carol',
      email: 'carol@example.com',
      subject: 'Document checkout',
      timestamp: '2026-03-04T10:00:00Z',
      coAuthors: [],
      files: [],
    },
  ];

  const insertCommit = db.prepare(`
    INSERT INTO commits
    (namespace, hash, author, email, msg, subject, timestamp, co_authors_json, files_json, payload, position, stored_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  commits.forEach((commit, index) => {
    insertCommit.run(
      commitsNs,
      commit.hash,
      commit.author,
      commit.email,
      null,
      commit.subject,
      commit.timestamp,
      JSON.stringify(commit.coAuthors),
      JSON.stringify(commit.files),
      JSON.stringify(commit),
      index,
      storedAt
    );
  });

  db.exec('DELETE FROM codemaat_code_churn;');
  db.exec('DELETE FROM codemaat_file_coupling;');
  db.exec('DELETE FROM codemaat_entity_churn;');
  db.exec('DELETE FROM codemaat_entity_effort;');
  db.exec('DELETE FROM codemaat_entity_ownership;');

  db.prepare(`
    INSERT INTO codemaat_code_churn
    (date, added, deleted, commits, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('2026-03-01', 10, 2, 1, 0, storedAt, storedAt);
  db.prepare(`
    INSERT INTO codemaat_code_churn
    (date, added, deleted, commits, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('2026-03-02', 7, 3, 2, 1, storedAt, storedAt);

  db.prepare(`
    INSERT INTO codemaat_file_coupling
    (entity, coupled, degree, average_revs, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('src/checkout.ts', 'src/cart.ts', 75, 4, 0, storedAt, storedAt);
  db.prepare(`
    INSERT INTO codemaat_file_coupling
    (entity, coupled, degree, average_revs, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('src/payment.ts', 'src/cart.ts', 45, 2, 1, storedAt, storedAt);

  db.prepare(`
    INSERT INTO codemaat_entity_churn
    (entity, added, deleted, commits, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('src/checkout.ts', 10, 2, 1, 0, storedAt, storedAt);
  db.prepare(`
    INSERT INTO codemaat_entity_churn
    (entity, added, deleted, commits, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('src/cart.ts', 7, 3, 2, 1, storedAt, storedAt);

  db.prepare(`
    INSERT INTO codemaat_entity_effort
    (entity, total_revs, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('src/cart.ts', 5, 0, storedAt, storedAt);
  db.prepare(`
    INSERT INTO codemaat_entity_effort
    (entity, total_revs, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('src/checkout.ts', 3, 1, storedAt, storedAt);

  db.prepare(`
    INSERT INTO codemaat_entity_ownership
    (entity, author, added, deleted, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('src/cart.ts', 'Alice', 7, 3, 0, storedAt, storedAt);
  db.prepare(`
    INSERT INTO codemaat_entity_ownership
    (entity, author, added, deleted, position, stored_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('src/checkout.ts', 'Bob', 10, 2, 1, storedAt, storedAt);
}

try {
  ensureSchema();

  switch (fixture) {
    case 'prs':
      seedPrs();
      break;
    case 'pipelines':
      seedPipelines();
      break;
    case 'jira':
      seedJira();
      break;
    case 'architecture':
      seedArchitecture();
      break;
    case 'code-analysis':
      seedCodeAnalysis();
      break;
    default:
      throw new Error(`Unknown fixture: ${fixture}`);
  }
} finally {
  db.close();
}
NODE
}

seed_sqlite_prs_fixture() {
  local workspace="$1"
  seed_sqlite_fixture "${workspace}" prs
}

seed_sqlite_pipelines_fixture() {
  local workspace="$1"
  seed_sqlite_fixture "${workspace}" pipelines
}

seed_sqlite_jira_fixture() {
  local workspace="$1"
  seed_sqlite_fixture "${workspace}" jira
}

seed_sqlite_architecture_fixture() {
  local workspace="$1"
  seed_sqlite_fixture "${workspace}" architecture
}

seed_sqlite_code_analysis_fixture() {
  local workspace="$1"
  seed_sqlite_fixture "${workspace}" code-analysis
}
