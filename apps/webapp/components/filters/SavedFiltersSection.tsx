'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { useFilters } from '@/components/filters/FiltersContext';
import {
  DashboardSection,
  SavedFilterEntry,
  SavedFiltersStore,
} from './saved-filters-store';

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
  const savedFiltersStore = useMemo(() => new SavedFiltersStore(), []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  const loadSavedFilters = async () => {
    const entries = await savedFiltersStore.getBySection(activeSection, repository);
    onSavedFiltersLoaded?.(entries);
  };

  const handleDeleteSelectedFilter = async () => {
    if (!selectedSavedFilter) {
      return;
    }

    const shouldDelete = window.confirm(`Delete saved filter "${selectedSavedFilter.name}"?`);
    if (!shouldDelete) {
      return;
    }

    setActionError(null);
    await savedFiltersStore.remove(selectedSavedFilter.id);
    await loadSavedFilters();
  };

  const handleOpenSaveDialog = () => {
    setActionError(null);
    setSaveDialogOpen(true);
  };

  const handleCloseSaveDialog = () => {
    setSaveDialogOpen(false);
    setNewFilterName('');
  };

  const handleSaveNewFilter = async () => {
    const normalizedFilterName = newFilterName.trim();
    if (!normalizedFilterName) {
      return;
    }

    setActionError(null);

    try {
      await savedFiltersStore.save(activeSection, pathname, normalizedFilterName, filters, repository);
      await loadSavedFilters();
      handleCloseSaveDialog();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save filter.';
      setActionError(errorMessage);
    }
  };

  useEffect(() => {
    savedFiltersStore.getBySection(activeSection, repository)
      .then((entries) => {
        onSavedFiltersLoaded?.(entries);
      })
      .catch((error) => {
        console.warn('Unable to load saved filters', error);
      });
  }, [activeSection, onSavedFiltersLoaded, repository, savedFiltersStore]);

  return (
    <>
      <Stack direction="row" spacing={1}>
        <Button
          disabled={selectedSavedFilter ? true : false}
          variant="contained"
          size="small"
          onClick={() => {
            handleOpenSaveDialog();
          }}
        >
          Save Filter
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => {
            handleDeleteSelectedFilter().catch((error) => {
              console.warn('Unable to delete saved filter', error);
            });
          }}
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

      <Dialog open={isSaveDialogOpen} onClose={handleCloseSaveDialog} fullWidth maxWidth="sm">
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSaveDialog}>Cancel</Button>
          <Button
            onClick={() => {
              handleSaveNewFilter().catch((error) => {
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
    </>
  );
}