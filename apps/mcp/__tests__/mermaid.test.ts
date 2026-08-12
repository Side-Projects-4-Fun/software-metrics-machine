import { describe, expect, it } from 'vitest';
import { viewToMermaid } from '../src/metrics-reader';

describe('viewToMermaid', () => {
  it('renders an empty view as a flowchart header only', () => {
    expect(viewToMermaid({ nodes: [], edges: [] })).toBe('flowchart LR');
  });

  it('renders nodes with sanitized ids and labels with technology', () => {
    const mermaid = viewToMermaid({
      nodes: [
        { id: 'web-ui', name: 'Web UI', technology: 'Next.js' },
        { id: 'api/svc', name: 'API', technology: 'NestJS' },
      ],
      edges: [],
    });

    expect(mermaid).toBe(
      ['flowchart LR', '  web_ui["Web UI\\nNext.js"]', '  api_svc["API\\nNestJS"]'].join('\n')
    );
  });

  it('renders edges using description or kind as label', () => {
    const mermaid = viewToMermaid({
      nodes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      edges: [
        { source: 'a', target: 'b', description: 'calls' },
        { source: 'b', target: 'a', kind: 'depends' },
      ],
    });

    expect(mermaid).toContain('a -->|calls| b');
    expect(mermaid).toContain('b -->|depends| a');
  });

  it('sanitizes ids containing non-alphanumeric characters', () => {
    const mermaid = viewToMermaid({
      nodes: [{ id: 'svc-1.2', name: 'Svc' }],
      edges: [{ source: 'svc-1.2', target: 'db/foo', description: 'reads' }],
    });

    expect(mermaid).toContain('svc_1_2["Svc"]');
    expect(mermaid).toContain('svc_1_2 -->|reads| db_foo');
  });
});
