'use client';

import { FormEvent, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TargetInfo } from '@/components/charts/TargetInfo';
import type { BigOFileAnalysis, BigOFileSummary } from '@/server/api/sourceCode';

type BigOAnalysisCardProps = {
  files: BigOFileSummary[];
  search: string;
};

type SortDirection = 'asc' | 'desc';

export function BigOAnalysisCard({ files, search }: BigOAnalysisCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(search);
  const [scoreSortDirection, setScoreSortDirection] = useState<SortDirection>('desc');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BigOFileAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineClassifications = useMemo(() => {
    return new Map(analysis?.lines.map((line) => [line.lineNumber, line]) ?? []);
  }, [analysis]);

  const sortedFiles = useMemo(() => {
    const sortDirection = scoreSortDirection === 'asc' ? 1 : -1;

    return [...files].sort((left, right) => {
      const scoreComparison = (left.score - right.score) * sortDirection;

      if (scoreComparison !== 0) {
        return scoreComparison;
      }

      return left.filePath.localeCompare(right.filePath);
    });
  }, [files, scoreSortDirection]);

  const toggleScoreSort = () => {
    setScoreSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (query.trim()) {
      params.set('big_o_search', query.trim());
    } else {
      params.delete('big_o_search');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const openFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setAnalysis(null);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/source-code/big-o/file?file_path=${encodeURIComponent(filePath)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load file analysis: ${response.statusText}`);
      }

      setAnalysis((await response.json()) as BigOFileAnalysis);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load file analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CardTitle>Big O Classification</CardTitle>
              <TargetInfo metric="big-o-classification" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Heuristic static complexity risk by source file.
            </Typography>
          </Box>

          <Box component="form" onSubmit={submitSearch} sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              label="Search files"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button type="submit" variant="contained">
              Search
            </Button>
          </Box>
        </Stack>
      </CardHeader>

      <CardContent>
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>File path + file name</TableCell>
                <TableCell>Big O classification</TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active
                    direction={scoreSortDirection}
                    onClick={toggleScoreSort}
                  >
                    Score
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedFiles.map((file) => (
                <TableRow
                  key={file.filePath}
                  hover
                  onClick={() => openFile(file.filePath)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {file.fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {file.filePath}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={file.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Typography variant="body2">{file.score}</Typography>
                      {file.needsHelp ? (
                        <Chip size="small" color="warning" label="Needs help" />
                      ) : (
                        <Chip size="small" color="success" label="OK" />
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary">
                      No source files matched the current search.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      <Dialog open={selectedFile !== null} onClose={() => setSelectedFile(null)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selectedFile}
          <IconButton
            aria-label="Close"
            onClick={() => setSelectedFile(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
          {analysis && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip label={analysis.classification} />
                <Chip label={`Score ${analysis.score}`} />
                {analysis.needsHelp && <Chip color="warning" label="Needs performance attention" />}
              </Stack>

              <Box
                component="pre"
                sx={{
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontSize: 12,
                  lineHeight: 1.6,
                  m: 0,
                  overflow: 'auto',
                  p: 2,
                }}
              >
                {analysis.content.split(/\r?\n/).map((line, index) => {
                  const lineNumber = index + 1;
                  const classification = lineClassifications.get(lineNumber);

                  return (
                    <Box component="code" key={lineNumber} sx={{ display: 'block' }}>
                      <Box component="span" sx={{ color: 'text.secondary', pr: 2 }}>
                        {String(lineNumber).padStart(4, ' ')}
                      </Box>
                      {line}
                      {classification && (
                        <Box component="span" sx={{ color: 'warning.dark', pl: 2 }}>
                          {classification.classification} - {classification.reason}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
