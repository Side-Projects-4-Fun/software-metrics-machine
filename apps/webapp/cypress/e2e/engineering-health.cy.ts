/// <reference types="cypress" />

/**
 * Happy-path journey: a user opens the engineering health report and reads the
 * executive scorecards.
 *
 * `/engineering-health/evaluate` is served by the MSW handlers in
 * `cypress/mocks/handlers.mjs`.
 */
describe('Engineering health journey', () => {
  it('opens the engineering health report overview', () => {
    cy.visit('/engineering-health/');

    cy.contains('Engineering Health Overview').should('be.visible');
    cy.contains('Executive Summary').should('be.visible');
    cy.contains('Total metrics reviewed:').should('contain.text', '4');
  });

  it('renders one scorecard per engineering health category', () => {
    cy.visit('/engineering-health/');

    cy.get('[role="article"][aria-label="Deployment Frequency scorecard"]')
      .should('contain.text', '3.40 deployments/day')
      .and('contain.text', 'improving');

    cy.get('[role="article"][aria-label="Coverage scorecard"]')
      .should('contain.text', '81.50%')
      .and('contain.text', 'stable');

    cy.get('[role="article"][aria-label="Review Time scorecard"]')
      .should('contain.text', '6.20 hours')
      .and('contain.text', 'degrading');

    cy.get('[role="article"][aria-label="Ownership scorecard"]')
      .should('contain.text', '62.00%')
      .and('contain.text', 'unknown');
  });

  it('renders the delivery, quality, collaboration and architecture sections', () => {
    cy.visit('/engineering-health/');

    cy.contains('h2', 'Delivery').should('be.visible');
    cy.contains('h2', 'Quality').should('be.visible');
    cy.contains('h2', 'Collaboration').should('be.visible');
    cy.contains('h2', 'Architecture').should('be.visible');
    cy.contains('Data Confidence And References').should('be.visible');
  });
});
