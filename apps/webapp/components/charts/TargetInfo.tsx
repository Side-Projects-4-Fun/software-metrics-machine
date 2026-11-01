'use client';

import { useState, useCallback } from 'react';
import { Popover, Box, Link } from '@mui/material';
import { useMetricDefinition } from '@/components/providers/MetricCatalogProvider';
import type { MetricCatalogSource } from '@/lib/metrics/metric-catalog';

interface TargetInfoProps {
  /** Catalogued metric id, e.g. `cr-review-time`. */
  metric?: string;
  /** Explicit target for cross-cutting explanations without a catalog entry. */
  target?: string;
  /** Explicit description paired with `target`. */
  description?: string;
  /** Explicit sources paired with `target` and `description`. */
  sources?: MetricCatalogSource[];
}

interface ResolvedDefinition {
  target?: string;
  description: string;
  sources: readonly MetricCatalogSource[];
}

export function TargetInfo({ metric, target, description, sources }: TargetInfoProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const catalogEntry = useMetricDefinition(metric);

  let definition: ResolvedDefinition | undefined;

  if (catalogEntry) {
    definition = {
      target: catalogEntry.target?.description,
      description: catalogEntry.definition.description,
      sources: catalogEntry.sources ?? [],
    };
  } else if (target && description) {
    definition = { target, description, sources: sources ?? [] };
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setAnchorEl(e.currentTarget);
    }
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  if (!definition) {
    return null;
  }

  return (
    <>
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 cursor-pointer hover:bg-blue-200 transition-colors shrink-0 select-none"
      >
        <span className="text-xs font-semibold">i</span>
      </div>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              maxWidth: 380,
              borderRadius: 1,
            },
          },
        }}
      >
        <Box sx={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
          {definition.target ? (
            <Box sx={{ fontWeight: 600, mb: 0.5 }}>
              Target: {definition.target}
            </Box>
          ) : null}
          <Box sx={{ color: 'text.secondary', mb: definition.sources.length > 0 ? 1.5 : 0 }}>
            {definition.description}
          </Box>
          {definition.sources.length > 0 && (
            <Box
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                pt: 1.5,
              }}
            >
              <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
                Sources
              </Box>
              {definition.sources.map((source, idx) => (
                <Box key={idx} sx={{ mb: 0.5, '&:last-child': { mb: 0 } }}>
                  <Link
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      fontSize: '0.75rem',
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {idx + 1}. {source.label}
                  </Link>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
}
