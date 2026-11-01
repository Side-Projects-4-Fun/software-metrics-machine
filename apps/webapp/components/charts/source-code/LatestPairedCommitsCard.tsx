'use client';
import { useLinkBuilder } from "@/components/providers/LinkBuilderContext";
import { CardTitle } from "@/components/ui/card";
import { Card, CardHeader, CardContent } from "@mui/material";
import { TargetInfo } from '@/components/charts/TargetInfo';

export function LatestPairedCommitsCard({ data }: { data: Array<{ hash: string; author: string; co_authors: string[]; timestamp: string; subject: string }> }) {
  const { urlBuilder } = useLinkBuilder();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Latest 20 Paired Commits</CardTitle>
          <TargetInfo metric="code-pairing-index" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Most recent commits containing co-authors.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No paired commits found for the selected filters.</p>
        ) : (
          <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
            {data.map((commit) => (
              <div key={commit.hash} className="border rounded-md p-3">
                <div className="flex items-center justify-between gap-2">
                  {urlBuilder ? (
                    <a
                      href={urlBuilder.getCommitUrl(commit.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-blue-700 hover:underline"
                      title="Open commit in repository"
                    >
                      {commit.hash.slice(0, 8)}
                    </a>
                  ) : (
                    <p className="text-xs font-mono text-gray-700">{commit.hash.slice(0, 8)}</p>
                  )}
                  <p className="text-xs text-gray-500">{new Date(commit.timestamp).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-900">{commit.subject || '(no subject)'}</p>
                <p className="mt-1 text-xs text-gray-700">
                  <span className="font-semibold">Author:</span> {commit.author}
                </p>
                <p className="text-xs text-gray-700">
                  <span className="font-semibold">Co-authors:</span> {commit.co_authors.join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}