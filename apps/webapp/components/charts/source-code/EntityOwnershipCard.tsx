'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { Tab, Tabs } from '@mui/material';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { EntityOwnershipData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';

interface AuthorData {
  author: string;
  added: number;
  deleted: number;
  topEntity: string;
  topEntityChanges: number;
}

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: AuthorData;
}

const AuthorTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) => {
  if (active && payload && payload.length) {
    const topEntity = (payload[0].payload as AuthorData)?.topEntity || '-';
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-gray-600">Top file: {topEntity}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const EntityTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow">
        <p className="font-semibold">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function EntityOwnershipCard({ data }: { data: EntityOwnershipData[] }) {
  const [activeTab, setActiveTab] = useState<'by-author' | 'by-file' | 'by-entity'>('by-author');

  const byAuthor = useMemo(() => {
    type AuthorAggregate = {
      author: string;
      added: number;
      deleted: number;
      topEntity: string;
      topEntityChanges: number;
    };

    const accumulator = new Map<string, AuthorAggregate>();

    for (const row of ensureArray<EntityOwnershipData>(data)) {
      const author = (row.author || '').trim() || 'Unknown';
      const current =
        accumulator.get(author) ||
        ({
          author,
          added: 0,
          deleted: 0,
          topEntity: '-',
          topEntityChanges: 0,
        } satisfies AuthorAggregate);
      const entity = (row.entity || '').trim() || '-';
      const changes = Number(row.added || 0) + Number(row.deleted || 0);

      current.added += Number(row.added || 0);
      current.deleted += Number(row.deleted || 0);

      if (changes > current.topEntityChanges) {
        current.topEntity = entity;
        current.topEntityChanges = changes;
      }

      accumulator.set(author, current);
    }

    return Array.from(accumulator.values())
      .sort((a, b) => b.added + b.deleted - (a.added + a.deleted))
      .slice(0, 15);
  }, [data]);

  const topOwnerByFile = useMemo(() => {
    type AuthorStats = { author: string; added: number; deleted: number; changes: number };
    type FileStats = { entity: string; totalChanges: number; authors: Map<string, AuthorStats> };

    const files = new Map<string, FileStats>();

    for (const row of ensureArray<EntityOwnershipData>(data)) {
      const entity = (row.entity || '').trim();
      if (!entity) {
        continue;
      }

      const author = (row.author || '').trim() || 'Unknown';
      const added = Number(row.added || 0);
      const deleted = Number(row.deleted || 0);
      const changes = added + deleted;

      const fileStats =
        files.get(entity) ||
        ({
          entity,
          totalChanges: 0,
          authors: new Map<string, AuthorStats>(),
        } satisfies FileStats);

      const authorStats =
        fileStats.authors.get(author) ||
        ({
          author,
          added: 0,
          deleted: 0,
          changes: 0,
        } satisfies AuthorStats);

      authorStats.added += added;
      authorStats.deleted += deleted;
      authorStats.changes += changes;

      fileStats.totalChanges += changes;
      fileStats.authors.set(author, authorStats);
      files.set(entity, fileStats);
    }

    return Array.from(files.values())
      .map((file) => {
        const topAuthor = Array.from(file.authors.values()).sort((a, b) => b.changes - a.changes)[0];
        const ownershipPct = file.totalChanges > 0 ? (topAuthor.changes / file.totalChanges) * 100 : 0;

        return {
          entity: file.entity,
          owner: topAuthor.author,
          ownerAdded: topAuthor.added,
          ownerDeleted: topAuthor.deleted,
          ownerChanges: topAuthor.changes,
          totalChanges: file.totalChanges,
          ownershipPct,
        };
      })
      .sort((a, b) => b.ownershipPct - a.ownershipPct || b.ownerChanges - a.ownerChanges)
      .slice(0, 20);
  }, [data]);

  const byEntity = useMemo(() => {
    const accumulator = new Map<string, { entity: string; [key: string]: number | string }>();
    const allAuthors = new Set<string>();

    for (const row of ensureArray<EntityOwnershipData>(data)) {
      const entity = (row.entity || '').trim() || 'Unknown';
      const author = (row.author || '').trim() || 'Unknown';
      const added = Number(row.added || 0);
      const deleted = Number(row.deleted || 0);

      if (!accumulator.has(entity)) {
        accumulator.set(entity, { entity });
      }

      const currentEntity = accumulator.get(entity)!;

      const addedKey = `${author}-added`;
      const deletedKey = `${author}-deleted`;

      currentEntity[addedKey] = (Number(currentEntity[addedKey]) || 0) + added;
      currentEntity[deletedKey] = (Number(currentEntity[deletedKey]) || 0) + deleted;

      allAuthors.add(author);
      accumulator.set(entity, currentEntity);
    }

    return {
      data: Array.from(accumulator.values()).sort((a, b) => {
        const totalChangesA = Object.keys(a).reduce((sum, key) => (typeof a[key] === 'number' ? sum + (a[key] as number) : sum), 0);
        const totalChangesB = Object.keys(b).reduce((sum, key) => (typeof b[key] === 'number' ? sum + (b[key] as number) : sum), 0);
        return totalChangesB - totalChangesA;
      }).slice(0, 15),
      authors: Array.from(allAuthors).sort((a, b) => a.localeCompare(b)),
    };
  }, [data]);

  const authorColors = useMemo(() => {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c',
      '#d0ed57', '#ffc658', '#ff7300', '#83a6ed', '#8dd1e1',
    ];
    const colorMap = new Map<string, { added: string; deleted: string }>();
    byEntity.authors.forEach((author, index) => {
      const baseColor = colors[index % colors.length];
      // Simple heuristic for lighter/darker shades
      colorMap.set(author, {
        added: baseColor, // Using base color for added
        deleted: `#${Math.min(parseInt(baseColor.slice(1), 16) + 0x333333, 0xFFFFFF).toString(16).padStart(6, '0')}`, // Lighter shade for deleted
      });
    });
    return colorMap;
  }, [byEntity.authors]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Ownership</CardTitle>
          <TargetInfo metric="ownership" />
        </div>
        <Box sx={{ mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_event, value) => setActiveTab(value as 'by-author' | 'by-file')}
            textColor="secondary"
            indicatorColor="secondary"
            aria-label="ownership tabs"
          >
            <Tab value="by-author" label="By Author" />
            <Tab value="by-file" label="By File" />
            <Tab value="by-entity" label="By Entity" />
          </Tabs>
        </Box>
        {activeTab === 'by-author' ? (
          <p className="mt-2 text-sm text-gray-600">
            Ranks contributors by total code changes. Green is lines added and red is lines deleted
            per author. Hover an author to see the file they changed the most.
          </p>
        ) : activeTab === 'by-file' ? (
          <p className="mt-2 text-sm text-gray-600">
            For each file, shows the person who changed it the most (added + deleted), plus
            ownership percentage relative to all changes on that file.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            Displays lines added and deleted per author for each entity, allowing insight into contribution distribution across files.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {activeTab === 'by-author' ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byAuthor}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="author" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip content={<AuthorTooltip />} />
              <Legend />
              <Bar dataKey="added" stackId="a" fill="#82ca9d" name="Added" />
              <Bar dataKey="deleted" stackId="a" fill="#ff6b6b" name="Deleted" />
            </BarChart>
          </ResponsiveContainer>
        ) : activeTab === 'by-file' ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topOwnerByFile}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="entity" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="ownerAdded" stackId="a" fill="#82ca9d" name="Owner Added" />
              <Bar dataKey="ownerDeleted" stackId="a" fill="#ff6b6b" name="Owner Deleted" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byEntity.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="entity" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip content={<EntityTooltip />} />
              <Legend />
              {byEntity.authors.map((author) => (
                <Bar
                  key={`${author}-added`}
                  dataKey={`${author}-added`}
                  stackId={author}
                  fill={authorColors.get(author)?.added}
                  name={`${author} added`}
                />
              ))}
              {byEntity.authors.map((author) => (
                <Bar
                  key={`${author}-deleted`}
                  dataKey={`${author}-deleted`}
                  stackId={author}
                  fill={authorColors.get(author)?.deleted}
                  name={`${author} deleted`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
