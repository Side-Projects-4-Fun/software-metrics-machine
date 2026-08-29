'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { useFilters } from '@/components/filters/FiltersContext';
import type { DashboardSection, SavedFilterEntry } from './saved-filters-store';
import type { DashboardFilters } from '@/components/filters/DashboardFilters';
import { getSavedFiltersBySection, saveSavedFilter, removeSavedFilter } from './saved-filters-actions';

interface SavedFiltersSectionProps {
  activeSection: DashboardSection;
  pathname: string;
  repository: string;
  selectedSavedFilter?: SavedFilterEntry;
  onSavedFiltersLoaded?: (entries: SavedFilterEntry[]) => void;
}

export default function SavedFiltersSection({
  activeSection,
  pathname,
  repository,
  selectedSavedFilter,
  onSavedFiltersLoaded,
}: SavedFiltersSectionProps) {
  const { filters } = useFilters();
  const [isSaveDialogOpen, setSaveDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSavedFilters = useCallback(async () => {
    const entries = await getSavedFiltersBySection(activeSection, repository);
    onSavedFiltersLoaded?.(entries);
  }, [activeSection, onSavedFiltersLoaded, repository]);

  const handleDeleteSelectedFilter = async () => {
    if (!selectedSavedFilter) { return; }
    const shouldDelete = window.confirm(`Delete saved filter "${selectedSavedFilter.name}"?`);
    if (!shouldDelete) { return; }

    setActionError(null);
    try {
      await removeSavedFilter(selectedSavedFilter.id);
      await loadSavedFilters();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete saved filter.');
    }
  };

  const handleOpenSaveDialog = () => {
    setSaveDialogOpen(true);
  };

  useEffect(() => {
    getSavedFiltersBySection(activeSection, repository)
      .then((entries) => {
        onSavedFiltersLoaded?.(entries);
      })
      .catch((error) => {
        console.warn('Unable to load saved filters', error);
      });
  }, [activeSection, onSavedFiltersLoaded, repository]);

  return (
    <>
      <Stack direction="row" spacing={1}>
        <Button
          disabled={selectedSavedFilter ? true : false}
          variant="contained"
          size="small"
          onClick={() => { handleOpenSaveDialog(); }}
        >
          Save Filter
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => { handleDeleteSelectedFilter().catch((error) => { console.warn('Unable to delete saved filter', error); }); }}
          disabled={!selectedSavedFilter}
        >
          Delete Filter
        </Button>
      </Stack>
      {actionError && (
        <Typography variant="caption" color="error">
          {actionError}
        </Typography>
      )}

      <SaveFilterDialog
        key={isSaveDialogOpen ? 'open' : 'closed'}
        open={isSaveDialogOpen}
        activeSection={activeSection}
        pathname={pathname}
        repository={repository}
        filters={filters}
        onClose={() => setSaveDialogOpen(false)}
        onSaved={loadSavedFilters}
      />
    </>
  );
}

interface SaveFilterDialogProps {
  open: boolean;
  activeSection: DashboardSection;
  pathname: string;
  repository: string;
  filters: DashboardFilters;
  onClose: () => void;
  onSaved: () => void;
}

function SaveFilterDialog({
  open,
  activeSection,
  pathname,
  repository,
  filters,
  onClose,
  onSaved,
}: SaveFilterDialogProps) {
  const [newFilterName, setNewFilterName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSave = async () => {
    const normalizedFilterName = newFilterName.trim();
    if (!normalizedFilterName) { return; }

    setActionError(null);
    try {
      await saveSavedFilter(activeSection, pathname, normalizedFilterName, filters, repository);
      onSaved();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save filter.';
      setActionError(errorMessage);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Save Filter</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Filter name"
          type="text"
          fullWidth
          value={newFilterName}
          onChange={(event) => setNewFilterName(event.target.value)}
          placeholder="e.g. Team A - last 30 days"
        />
        {actionError && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            {actionError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            handleSave().catch((error) => {
              console.warn('Unable to save filter', error);
            });
          }}
          variant="contained"
          disabled={newFilterName.trim().length === 0}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
