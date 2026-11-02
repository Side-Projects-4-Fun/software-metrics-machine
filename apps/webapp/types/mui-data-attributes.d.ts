/**
 * Opt in to `data-testid` on MUI slot props.
 *
 * MUI rejects arbitrary `data-*` keys on slot props by design and exposes
 * `DataAttributesOverrides` as the documented augmentation point. Test ids on
 * slot roots (for example the persistent `Drawer` docked root, which carries the
 * `pointer-events` guard) are the contract used by the Cypress journeys, so the
 * key is declared here once instead of relying on undocumented prop spreading.
 */
declare module '@mui/utils/types' {
  interface DataAttributesOverrides {
    'data-testid'?: string;
  }
}
