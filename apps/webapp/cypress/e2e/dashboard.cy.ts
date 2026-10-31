/// <reference types="cypress" />

/**
 * Happy-path journey: a user opens the dashboard and reads the insights overview.
 *
 * The responses come from the MSW handlers in `cypress/mocks/handlers.mjs`,
 * loaded into the Next.js Node process by `cypress/support/run-e2e.mjs` — server
 * components fetch `SMM_REST_BASE_URL`, which the handlers intercept.
 */
describe('Dashboard journey', () => {
  it('opens the insights overview from the dashboard entry point', () => {
    cy.visit('/dashboard');

    cy.location('pathname').should('eq', '/dashboard/insights/');
    cy.get('[role="tablist"]').should('be.visible');
    cy.contains('[role="tab"]', 'Insights').should('have.attr', 'aria-selected', 'true');
  });

  it('shows the active project in the application bar', () => {
    cy.visit('/dashboard/insights/');

    cy.contains('Software Metrics Machine - acme/widgets').should('be.visible');
  });

  it('renders the pairing index, pipeline and change request summary cards', () => {
    cy.visit('/dashboard/insights/');

    cy.contains('.MuiCardHeader-title', 'Pairing Index')
      .closest('.MuiCard-root')
      .should('contain.text', '62.50%')
      .and('contain.text', '30 of 48 commits');

    cy.contains('.MuiCardHeader-title', 'Pipeline Runs')
      .closest('.MuiCard-root')
      .should('contain.text', '128')
      .and('contain.text', '2 In Progress')
      .and('contain.text', '1 Queued');

    cy.contains('.MuiCardHeader-title', 'Change Requests')
      .closest('.MuiCard-root')
      .should('contain.text', '96')
      .and('contain.text', '74 Merged')
      .and('contain.text', '8 Open');
  });

  it('renders the deployment frequency section', () => {
    cy.visit('/dashboard/insights/');

    cy.contains('.MuiCardHeader-title', 'Deployment Frequency').should('be.visible');
  });
});
