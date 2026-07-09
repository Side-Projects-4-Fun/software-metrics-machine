'use client';

import {
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TargetInfo } from '@/components/charts/TargetInfo';
import type { CrapMetricData } from './types';
import { toCrapRisk } from './crap-metric';

export default function CrapMetricCard({
  data,
  topEntries,
}: {
  data: CrapMetricData[];
  topEntries: number;
}) {
  const rows = [...data]
    .sort((left, right) => {
      const scoreComparison = right.crap - left.crap;

      if (scoreComparison !== 0) {
        return scoreComparison;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, topEntries);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>CRAP Score (Top {topEntries})</CardTitle>
          <TargetInfo metric="crap-score" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Combines cyclomatic complexity and test coverage to highlight complex files that are
          weakly protected by tests.
        </p>
      </CardHeader>

      <CardContent>
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>File</TableCell>
                <TableCell align="right">CRAP</TableCell>
                <TableCell align="right">Complexity</TableCell>
                <TableCell align="right">Coverage</TableCell>
                <TableCell>Risk</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const risk = toCrapRisk(row.crap);

                return (
                  <TableRow key={row.componentKey}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.componentKey}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{row.crap.toFixed(1)}</TableCell>
                    <TableCell align="right">{row.complexity}</TableCell>
                    <TableCell align="right">{row.coverage.toFixed(1)}%</TableCell>
                    <TableCell>
                      <Chip size="small" color={risk.color} label={risk.label} />
                    </TableCell>
                  </TableRow>
                );
              })}

              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        No SonarQube file measures are available for CRAP yet.
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Fetch component-tree metrics with complexity and coverage to populate this
                        card.
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
