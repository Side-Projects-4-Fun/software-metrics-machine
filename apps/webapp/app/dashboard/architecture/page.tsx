import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  defaultFilters,
  parseDashboardFilters,
} from '@/components/filters/DashboardFilters';
import {
  architectureAPI,
  type ArchitectureEdge,
  type ArchitectureView,
  type ArchitectureNode,
  type ArchitectureEvaluation,
} from '@/server/api/architecture';
import MermaidC4Diagram from '@/components/architecture/MermaidC4Diagram';
import ArchitectureLevelTabs from '@/components/architecture/ArchitectureLevelTabs';
import ArchitectureEvaluationCard from '@/components/charts/architecture/ArchitectureEvaluationCard';

type ViewLevel = 'context' | 'container' | 'component' | 'code';

type ResultWrapper<T> = {
  result: T;
};

function unwrapResult<T>(data: T | ResultWrapper<T>): T {
  if (typeof data === 'object' && data !== null && 'result' in data) {
    return data.result;
  }
  return data;
}

function parseLevel(raw?: string | string[]): ViewLevel {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'context' || value === 'container' || value === 'component' || value === 'code') {
    return value;
  }
  return 'container';
}

function createLevelHref(
  params: Record<string, string | string[] | undefined>,
  level: ViewLevel
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === 'level' || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
      continue;
    }

    search.set(key, value);
  }

  search.set('level', level);
  const query = search.toString();
  return query ? `/dashboard/architecture?${query}` : '/dashboard/architecture';
}

function toMermaidId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function resolveNodeName(view: ArchitectureView, id: string): string {
  return view.nodes.find((node: ArchitectureNode) => node.id === id)?.name || id;
}

function buildMermaidC4(view: ArchitectureView, level: ViewLevel): string {
  const title = view.title.replace(/"/g, '');
  const lines: string[] = [];

  if (level === 'context') {
    lines.push('C4Context');
    lines.push(`title ${title}`);

    for (const node of view.nodes) {
      const id = toMermaidId(node.id);
      const name = node.name.replace(/"/g, '');
      const description = (node.description || '').replace(/"/g, '');

      if (node.kind === 'person') {
        lines.push(`Person(${id}, "${name}", "${description}")`);
      } else {
        lines.push(`System(${id}, "${name}", "${description}")`);
      }
    }
  } else if (level === 'container') {
    lines.push('C4Container');
    lines.push(`title ${title}`);

    for (const node of view.nodes) {
      const id = toMermaidId(node.id);
      const name = node.name.replace(/"/g, '');
      const technology = (node.technology || '').replace(/"/g, '');
      const description = (node.description || '').replace(/"/g, '');

      if (node.kind === 'person') {
        lines.push(`Person(${id}, "${name}", "${description}")`);
      } else if (node.kind === 'system') {
        lines.push(`System(${id}, "${name}", "${description}")`);
      } else {
        lines.push(`Container(${id}, "${name}", "${technology}", "${description}")`);
      }
    }
  } else {
    lines.push('C4Component');
    lines.push(`title ${title}`);

    for (const node of view.nodes) {
      const id = toMermaidId(node.id);
      const name = node.name.replace(/"/g, '');
      const technology = (node.technology || '').replace(/"/g, '');
      const description = (node.description || '').replace(/"/g, '');

      if (node.kind === 'person') {
        lines.push(`Person(${id}, "${name}", "${description}")`);
      } else if (node.kind === 'container') {
        lines.push(`Container(${id}, "${name}", "${technology}", "${description}")`);
      } else {
        lines.push(`Component(${id}, "${name}", "${technology}", "${description}")`);
      }
    }
  }

  for (const edge of view.edges) {
    const source = toMermaidId(edge.source);
    const target = toMermaidId(edge.target);
    const label = (edge.description || edge.kind).replace(/"/g, '');
    lines.push(`Rel(${source}, ${target}, "${label}")`);
  }

  return lines.join('\n');
}

export default async function ArchitecturePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const filters = parseDashboardFilters(params, defaultFilters);
  const selectedLevel = parseLevel(params.level);

  let summary: Awaited<ReturnType<typeof architectureAPI.summary>>['result'] = null;
  let selectedView: Awaited<ReturnType<typeof architectureAPI.view>>['result'] = null;
  let evaluation: ArchitectureEvaluation | null = null;

  try {
    const [summaryResponse, viewResponse, evaluationResponse] = await Promise.all([
      architectureAPI.summary(),
      architectureAPI.view(selectedLevel, undefined, {
        ignore_files: filters.ignorePatternFiles || undefined,
        include_only: filters.includePatternFiles || undefined,
      }),
      architectureAPI.evaluate({
        level: selectedLevel,
        ignore_files: filters.ignorePatternFiles || undefined,
        include_only: filters.includePatternFiles || undefined,
      }),
    ]);

    summary = unwrapResult(summaryResponse);
    selectedView = unwrapResult(viewResponse);
    evaluation = evaluationResponse;
  } catch (error) {
    console.error('Error loading architecture data', error);
    evaluation = null;
  }

  if (!summary || !selectedView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No architecture snapshot available</CardTitle>
        </CardHeader>
        <CardContent>
          Run CLI generation first: smm architecture generate
        </CardContent>
      </Card>
    );
  }

  const mermaidChart = buildMermaidC4(selectedView, selectedLevel);
  const tabItems = (['context', 'container', 'component', 'code'] as ViewLevel[]).map((level) => ({
    level,
    href: createLevelHref(params, level),
    disabled: !summary.views.some((view) => view.level === level),
  }));

  return (
    <div className="space-y-6">
      {evaluation ? (
        <div className="grid grid-cols-1 gap-6">
          <ArchitectureEvaluationCard data={evaluation} />
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Architecture Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-semibold">Snapshot</p>
              <p>{summary.snapshot_id}</p>
            </div>
            <div>
              <p className="font-semibold">Generated At</p>
              <p>{summary.generated_at}</p>
            </div>
            <div>
              <p className="font-semibold">Commits Considered</p>
              <p>{summary.commit_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selectedView.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchitectureLevelTabs selectedLevel={selectedLevel} items={tabItems} />

          <div className="mb-6">
            <h3 className="font-semibold mb-3">Mermaid C4 Diagram</h3>
            <MermaidC4Diagram chart={mermaidChart} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Elements</h3>
              <ul className="space-y-2">
                {selectedView.nodes.map((node: ArchitectureNode) => (
                  <li key={node.id} className="border rounded-md p-3">
                    <p className="font-medium">{node.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{node.kind}</p>
                    <p className="text-sm text-muted-foreground">{node.technology || 'Unknown technology'}</p>
                    {node.description ? (
                      <p className="text-sm text-muted-foreground mt-1">{node.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Relationships</h3>
              <ul className="space-y-2">
                {selectedView.edges.map((edge: ArchitectureEdge) => {
                  const source =
                    selectedView.nodes.find((node: ArchitectureNode) => node.id === edge.source)
                      ?.name || edge.source;
                  const target =
                    selectedView.nodes.find((node: ArchitectureNode) => node.id === edge.target)
                      ?.name || edge.target;
                  return (
                    <li key={edge.id} className="border rounded-md p-3">
                      <p className="font-medium">{source} &quot;-&gt;&quot; {target}</p>
                      <p className="text-sm text-muted-foreground">{edge.description || edge.kind}</p>
                      <p className="text-xs text-muted-foreground">Confidence: {Math.round(edge.confidence * 100)}%</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
