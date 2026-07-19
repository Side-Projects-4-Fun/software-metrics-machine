// Global type declarations for Cypress custom commands

declare namespace Cypress {
  interface Chainable {
    /**
     * Use custom MSW handlers for mocking API responses
     * @param handlers - Array of MSW request handlers
     */
    mswUse: (...handlers: unknown[]) => void;
    
    /**
     * Reset MSW handlers to default
     */
    mswResetHandlers: () => void;
  }
}