'use client';

import { useEffect, useState } from 'react';
import mermaid from 'mermaid';

type MermaidC4DiagramProps = {
  chart: string;
};

export default function MermaidC4Diagram({ chart }: MermaidC4DiagramProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [renderId] = useState(() => `mermaid-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    let mounted = true;

    async function renderChart() {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
        });

        const { svg: renderedSvg } = await mermaid.render(renderId, chart);
        if (!mounted) {
          return;
        }
        setSvg(renderedSvg);
        setError('');
      } catch (err) {
        if (!mounted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to render Mermaid diagram';
        setError(message);
      }
    }

    renderChart();

    return () => {
      mounted = false;
    };
  }, [chart, renderId]);

  if (error) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        Mermaid render error: {error}
      </div>
    );
  }

  if (!svg) {
    return <div className="text-sm text-muted-foreground">Rendering Mermaid diagram...</div>;
  }

  return (
    <div
      className="overflow-auto rounded-md border bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
