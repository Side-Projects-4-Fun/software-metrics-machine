<script setup lang="ts">
import { computed, ref } from 'vue';
import { withBase } from 'vitepress';
import catalogCsv from '../../../public/metrics-catalog.csv?raw';

interface MetricCatalogRow {
  id: string;
  namespace: string;
  label: string;
  description: string;
  evidence: string;
  formula: string;
  notation: string;
  unit: string;
  direction: string;
  shape: string;
  visibility: string;
  status: string;
  target: string;
  cli: string[];
  rest: string[];
  mcp: string[];
}

interface SurfaceGroup {
  name: string;
  values: string[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function splitSurfaces(value: string): string[] {
  return value.length === 0 ? [] : value.split(' | ');
}

function toMetrics(text: string): MetricCatalogRow[] {
  const [header, ...dataRows] = parseCsv(text);
  const columns = new Map(header.map((name, index) => [name, index]));
  const cell = (cells: string[], name: string): string => cells[columns.get(name) ?? -1] ?? '';

  return dataRows
    .filter((cells) => cells.length > 1 && cell(cells, 'id').length > 0)
    .map((cells) => ({
      id: cell(cells, 'id'),
      namespace: cell(cells, 'namespace'),
      label: cell(cells, 'label'),
      description: cell(cells, 'description'),
      evidence: cell(cells, 'evidence'),
      formula: cell(cells, 'formula'),
      notation: cell(cells, 'notation'),
      unit: cell(cells, 'unit'),
      direction: cell(cells, 'direction'),
      shape: cell(cells, 'shape'),
      visibility: cell(cells, 'visibility'),
      status: cell(cells, 'status'),
      target: cell(cells, 'target'),
      cli: splitSurfaces(cell(cells, 'cli')),
      rest: splitSurfaces(cell(cells, 'rest')),
      mcp: splitSurfaces(cell(cells, 'mcp')),
    }));
}

const metrics = toMetrics(catalogCsv);

const namespaceLabels: Record<string, string> = {
  cr: 'Change requests',
  pl: 'Pipelines',
  code: 'Source code',
  sq: 'SonarQube',
  arch: 'Architecture',
  issue: 'Issues',
  eh: 'Engineering health',
};

const directionLabels: Record<string, string> = {
  higher_is_better: 'higher is better',
  lower_is_better: 'lower is better',
  neutral: 'neutral',
};

const namespaceKeys = Object.keys(namespaceLabels);
const query = ref('');
const selectedNamespace = ref('all');
const csvUrl = withBase('/metrics-catalog.csv');

const filteredMetrics = computed(() => {
  const term = query.value.trim().toLowerCase();

  return metrics.filter((metric) => {
    const namespaceMatches =
      selectedNamespace.value === 'all' || metric.namespace === selectedNamespace.value;
    if (!namespaceMatches) {
      return false;
    }
    if (term.length === 0) {
      return true;
    }
    return [
      metric.id,
      metric.label,
      metric.description,
      metric.evidence,
      metric.formula,
      metric.notation,
    ].some((value) => value.toLowerCase().includes(term));
  });
});

function surfacesFor(metric: MetricCatalogRow): SurfaceGroup[] {
  return [
    { name: 'CLI', values: metric.cli },
    { name: 'REST', values: metric.rest },
    { name: 'MCP', values: metric.mcp },
  ].filter((surface) => surface.values.length > 0);
}
</script>

<template>
  <div class="smm-catalog">
    <div class="smm-catalog__toolbar">
      <label class="smm-catalog__control">
        <span class="smm-catalog__label">Search</span>
        <input
          v-model="query"
          class="smm-catalog__input"
          type="search"
          placeholder="id, name, or description"
        />
      </label>
      <label class="smm-catalog__control">
        <span class="smm-catalog__label">Namespace</span>
        <select v-model="selectedNamespace" class="smm-catalog__input">
          <option value="all">All namespaces</option>
          <option v-for="key in namespaceKeys" :key="key" :value="key">
            {{ namespaceLabels[key] }}
          </option>
        </select>
      </label>
      <a class="smm-catalog__download" :href="csvUrl" download="smm-metrics-catalog.csv">
        Download CSV
      </a>
    </div>

    <p class="smm-catalog__count">
      Showing {{ filteredMetrics.length }} of {{ metrics.length }} metrics
    </p>

    <div class="smm-catalog__table-wrapper">
      <table class="smm-catalog__table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Metric</th>
            <th scope="col">What it measures</th>
            <th scope="col">How it is computed</th>
            <th scope="col">Unit</th>
            <th scope="col">Direction</th>
            <th scope="col">Surfaces</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="metric in filteredMetrics" :id="`metric-${metric.id}`" :key="metric.id">
            <td>
              <code>{{ metric.id }}</code>
            </td>
            <td>
              {{ metric.label }}
              <span v-if="metric.status === 'deprecated'" class="smm-catalog__badge"
                >deprecated</span
              >
              <span v-if="metric.visibility === 'internal'" class="smm-catalog__badge"
                >internal</span
              >
            </td>
            <td>
              {{ metric.description }}
              <span v-if="metric.target" class="smm-catalog__target"
                >Target: {{ metric.target }}</span
              >
            </td>
            <td>
              <span class="smm-catalog__computation-label">Evidence</span>
              {{ metric.evidence }}
              <span class="smm-catalog__computation-label">Formula</span>
              {{ metric.formula }}
              <span class="smm-catalog__computation-label">Notation</span>
              <code class="smm-catalog__notation">{{ metric.notation }}</code>
            </td>
            <td>{{ metric.unit }}</td>
            <td>{{ directionLabels[metric.direction] ?? metric.direction }}</td>
            <td>
              <div
                v-for="surface in surfacesFor(metric)"
                :key="surface.name"
                class="smm-catalog__surface"
              >
                <span class="smm-catalog__surface-name">{{ surface.name }}</span>
                <code v-for="value in surface.values" :key="value">{{ value }}</code>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="filteredMetrics.length === 0" class="smm-catalog__empty">
      No metric matches the current filters.
    </p>
  </div>
</template>

<style scoped>
.smm-catalog {
  margin: 1.5rem 0 2rem;
}

.smm-catalog__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background-color: var(--vp-c-bg-soft);
}

.smm-catalog__control {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1 1 12rem;
}

.smm-catalog__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}

.smm-catalog__input {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background-color: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
}

.smm-catalog__download {
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  color: var(--vp-c-brand-1);
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
}

.smm-catalog__download:hover {
  background-color: var(--vp-c-brand-soft);
}

.smm-catalog__count {
  margin: 0.75rem 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.smm-catalog__table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.smm-catalog__table {
  display: table;
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.smm-catalog__table th,
.smm-catalog__table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  text-align: left;
  vertical-align: top;
}

.smm-catalog__table th {
  background-color: var(--vp-c-bg-soft);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.smm-catalog__table tbody tr:last-child td {
  border-bottom: 0;
}

.smm-catalog__table tbody tr:target {
  background-color: var(--vp-c-brand-soft);
}

.smm-catalog__table td:first-child {
  white-space: nowrap;
}

.smm-catalog__table td:nth-child(2) {
  min-width: 10rem;
}

.smm-catalog__table td:nth-child(3) {
  min-width: 18rem;
}

.smm-catalog__table td:nth-child(4) {
  min-width: 20rem;
}

.smm-catalog__table td:nth-child(5),
.smm-catalog__table td:nth-child(6) {
  white-space: nowrap;
}

.smm-catalog__computation-label {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}

.smm-catalog__computation-label:first-child {
  margin-top: 0;
}

.smm-catalog__notation {
  display: block;
  font-size: 0.75rem;
  line-height: 1.5;
  word-break: break-word;
}

.smm-catalog__target {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}

.smm-catalog__badge {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0 0.35rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}

.smm-catalog__surface {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
}

.smm-catalog__surface:last-child {
  margin-bottom: 0;
}

.smm-catalog__surface-name {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--vp-c-text-2);
}

.smm-catalog__surface code {
  font-size: 0.7rem;
}

.smm-catalog__empty {
  margin-top: 1rem;
  color: var(--vp-c-text-2);
}
</style>
