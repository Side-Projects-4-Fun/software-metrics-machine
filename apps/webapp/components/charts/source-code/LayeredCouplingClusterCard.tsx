'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TargetInfo } from '@/components/charts/TargetInfo';

type LayeredCouplingData = {
  entity: string;
  coupled: string;
  degree: number;
  averageRevs: number;
};

type LayerCluster = {
  name: string;
  totalDegree: number;
  totalAverageRevs: number;
  records: LayeredCouplingData[];
};

type PositionedCluster = LayerCluster & {
  x: number;
  y: number;
  radius: number;
};

type PositionedChild = LayeredCouplingData & {
  x: number;
  y: number;
  radius: number;
};

const WIDTH = 1200;
const HEIGHT = 760;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_CLUSTERS = 28;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shortLabel(value: string): string {
  const segments = value.split('/').filter(Boolean);
  return segments[segments.length - 1] || value;
}

function formatTitle(cluster: LayerCluster): string {
  return `${cluster.name} · degree ${cluster.totalDegree}`;
}

function buildClusters(data: readonly LayeredCouplingData[]): LayerCluster[] {
  const clusters = new Map<string, LayerCluster>();
  const rows: readonly LayeredCouplingData[] = data;

  for (const row of rows) {
    const name = (row.entity || '').trim() || 'Unknown';
    const coupled = (row.coupled || '').trim();
    const degree = Number(row.degree || 0);
    const averageRevs = Number(row.averageRevs || 0);

    const cluster = clusters.get(name) || {
      name,
      totalDegree: 0,
      totalAverageRevs: 0,
      records: [],
    };

    cluster.totalDegree += degree;
    cluster.totalAverageRevs += averageRevs;
    cluster.records.push({
      entity: name,
      coupled,
      degree,
      averageRevs,
    });
    clusters.set(name, cluster);
  }

  return Array.from(clusters.values())
    .sort((left, right) => right.totalDegree - left.totalDegree)
    .slice(0, MAX_CLUSTERS);
}

function layoutClusters(clusters: LayerCluster[]): PositionedCluster[] {
  return clusters.map((cluster, index) => {
    const spiral = 110 + Math.sqrt(index) * 78;
    const angle = index * GOLDEN_ANGLE;
    const baseRadius = 42 + Math.sqrt(cluster.totalDegree || 1) * 3.4 + Math.log1p(cluster.records.length) * 6;
    const radius = clamp(baseRadius, 44, 132);
    const x = clamp(CENTER_X + Math.cos(angle) * spiral, radius + 24, WIDTH - radius - 24);
    const y = clamp(CENTER_Y + Math.sin(angle) * spiral, radius + 24, HEIGHT - radius - 24);

    return {
      ...cluster,
      x,
      y,
      radius,
    };
  });
}

function layoutChildren(cluster: PositionedCluster): PositionedChild[] {
  const maxDistance = cluster.radius * 0.6;
  const baseSize = Math.max(4, cluster.radius * 0.09);

  return cluster.records.map((record, index) => {
    const angle = index * GOLDEN_ANGLE;
    const distance = Math.min(maxDistance, 10 + index * 7);
    const radius = clamp(baseSize + Math.sqrt(record.degree || 1) * 0.8, 4, cluster.radius * 0.18);

    return {
      ...record,
      x: cluster.x + Math.cos(angle) * distance,
      y: cluster.y + Math.sin(angle) * distance,
      radius,
    };
  });
}

export default function LayeredCouplingClusterCard({ data }: { data: LayeredCouplingData[] }) {
  const clusters = useMemo(() => layoutClusters(buildClusters(data)), [data]);
  const maxDegree = Math.max(...clusters.map((cluster) => cluster.totalDegree), 1);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Layered Coupling</CardTitle>
          <TargetInfo metric="layered-coupling" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Bubble clusters represent architectural layers. Larger bubbles mean stronger coupling;
          the inner bubbles show the connected layers inside each cluster.
        </p>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-[760px] w-full min-w-[960px] rounded-2xl bg-sky-50"
            role="img"
            aria-label="Layered coupling cluster map"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="layerClusterGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.05" />
              </radialGradient>
              <radialGradient id="layerChildBubble" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#b91c1c" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.72" />
              </radialGradient>
            </defs>

            <circle cx={CENTER_X} cy={CENTER_Y} r={350} fill="url(#layerClusterGlow)" />
            <circle cx={CENTER_X} cy={CENTER_Y} r={430} fill="none" stroke="#cfe9f4" strokeWidth="18" opacity="0.55" />
            <circle cx={CENTER_X} cy={CENTER_Y} r={485} fill="none" stroke="#dbeff7" strokeWidth="12" opacity="0.45" />

            {clusters.map((cluster) => {
              const children = layoutChildren(cluster);
              const label = shortLabel(cluster.name);
              const labelSize = clamp(12 + Math.sqrt(cluster.radius), 13, 20);
              const opacity = 0.16 + (cluster.totalDegree / maxDegree) * 0.18;

              return (
                <g key={cluster.name}>
                  <circle
                    cx={cluster.x}
                    cy={cluster.y}
                    r={cluster.radius + 28}
                    fill="#7dd3fc"
                    opacity={0.08 + (cluster.totalDegree / maxDegree) * 0.1}
                  />
                  <circle
                    cx={cluster.x}
                    cy={cluster.y}
                    r={cluster.radius}
                    fill="#67d0ef"
                    opacity={opacity}
                    stroke="#8ad8ee"
                    strokeWidth="2"
                  >
                    <title>{formatTitle(cluster)}</title>
                  </circle>

                  {children.map((child) => {
                    const childOpacity = 0.54 + clamp(child.degree / 100, 0, 0.35);
                    return (
                      <circle
                        key={`${cluster.name}-${child.coupled}`}
                        cx={child.x}
                        cy={child.y}
                        r={child.radius}
                        fill="url(#layerChildBubble)"
                        opacity={childOpacity}
                        stroke="#7f1d1d"
                        strokeWidth="1.5"
                      >
                        <title>
                          {child.coupled || '(unknown)'} · degree {child.degree} · avg revs {child.averageRevs}
                        </title>
                      </circle>
                    );
                  })}

                  {cluster.radius >= 56 ? (
                    <>
                      <text
                        x={cluster.x}
                        y={cluster.y + 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontSize={labelSize}
                        fontWeight={700}
                        style={{ paintOrder: 'stroke', stroke: 'rgba(8, 47, 73, 0.18)', strokeWidth: 4 }}
                      >
                        {label}
                      </text>
                      <text
                        x={cluster.x}
                        y={cluster.y + labelSize + 12}
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize={11}
                        fontWeight={600}
                        opacity={0.92}
                      >
                        {cluster.totalDegree} deg
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
