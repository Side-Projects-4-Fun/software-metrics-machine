/// <reference types="cypress" />

import { reportDetailPage } from '../pages/report-detail.page';

/**
 * Happy-path journey: a user opens the reports list and reads a saved report.
 *
 * `/filters` (the saved filters + reports document) and the report section
 * evaluations are served by the MSW handlers in `cypress/mocks/handlers.mjs`.
 */
describe('Reports journey', () => {
  it('lists the saved reports for the active project', () => {
    cy.visit('/reports/');

    cy.contains('h1', 'Reports').should('be.visible');
    cy.contains('button', 'New Report').should('be.visible');
    cy.contains('No reports yet').should('not.exist');
    cy.contains('a', 'Sprint 12 Review')
      .should('be.visible')
      .and('have.attr', 'href')
      .and('include', '/reports/report-sprint-12');
  });

  it('opens the report and renders the evaluated change request section', () => {
    cy.visit('/reports/');
    cy.contains('a', 'Sprint 12 Review').click();

    cy.location('pathname').should('include', '/reports/report-sprint-12');
    cy.contains('h1', 'Sprint 12 Review').should('be.visible');
    cy.contains('a', 'Back to Reports').should('be.visible');
    cy.contains('Change Requests: Sprint 12 PRs').should('be.visible');
    cy.get('[aria-label="Change Requests — Sprint 12 PRs"]').should(
      'have.attr',
      'aria-expanded',
      'true',
    );
  });

  it('shows the change request health summary and bottleneck analysis', () => {
    cy.visit('/reports/report-sprint-12/');

    cy.contains('Change Request Health Summary')
      .closest('.MuiPaper-root')
      .should('contain.text', 'Total Change Requests')
      .and('contain.text', '96')
      .and('contain.text', 'Merge Rate')
      .and('contain.text', '77%');

    cy.contains('Bottleneck Analysis').should('be.visible');
    cy.contains('Slow review turnaround').should('be.visible');
  });

  it('keeps the timeline inside the page when a report has many date windows', () => {
    reportDetailPage.visit('report-quarter-windows');

    reportDetailPage.timelineWindows().should('have.length', 12);

    reportDetailPage.pageWidth().then(({ scrollWidth, clientWidth }) => {
      expect(scrollWidth, 'page scrollWidth exceeds the viewport').to.be.at.most(clientWidth + 1);
    });

    reportDetailPage.timelineWidth().then(({ scrollWidth, clientWidth }) => {
      expect(scrollWidth, 'timeline must scroll inside its own container').to.be.greaterThan(
        clientWidth,
      );
    });
  });

  it('returns to the reports list from the report detail page', () => {
    cy.visit('/reports/report-sprint-12/');
    cy.contains('a', 'Back to Reports').click();

    cy.location('pathname').should('not.include', 'report-sprint-12');
    cy.contains('Bottleneck Analysis').should('not.exist');
    cy.contains('a', 'Sprint 12 Review').should('be.visible');
    cy.contains('button', 'New Report').should('be.visible');
  });
});
