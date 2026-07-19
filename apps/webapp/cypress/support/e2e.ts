import './commands';
import type { RequestHandler } from 'msw';

// MSW setup for Cypress

  // Add MSW helper commands
  Cypress.Commands.add('mswUse', (...args: unknown[]) => {
    const handlers = args as RequestHandler[];
    cy.window().then((win: Window & { mswWorker?: { use: (...handlers: RequestHandler[]) => void } }) => {
      if (win.mswWorker) {
        win.mswWorker.use(...handlers);
      }
    });
  });

Cypress.Commands.add('mswResetHandlers', () => {
  cy.window().then((win: Window & { mswWorker?: { resetHandlers: () => void } }) => {
    if (win.mswWorker) {
      win.mswWorker.resetHandlers();
    }
  });
});

before(() => {
  // Start MSW worker
  cy.window().then(async (win) => {
    const { setupWorker } = await import('msw/browser');
    const { handlers } = await import('../mocks/handlers');
    const worker = setupWorker(...handlers);
    
    (win as Window & { mswWorker?: { stop: () => void } }).mswWorker = worker;
    await worker.start({
      onUnhandledRequest: 'warn',
    });
  });
});

after(() => {
  // Stop MSW worker
  cy.window().then((win: Window & { mswWorker?: { stop: () => void } }) => {
    if (win.mswWorker) {
      win.mswWorker.stop();
    }
  });
});