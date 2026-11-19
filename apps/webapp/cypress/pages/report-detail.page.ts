const CONTENT_TEST_ID = 'dashboard-content';
const TIMELINE_SCROLLER_TEST_ID = 'report-timeline-scroller';
const TIMELINE_WINDOW_TEST_ID = 'report-timeline-window';

const READY_TIMEOUT = 30_000;

const byTestId = (testId: string): string => `[data-testid="${testId}"]`;

export interface LayoutWidth {
  scrollWidth: number;
  clientWidth: number;
}

export class ReportDetailPage {
  visit(reportId: string): this {
    cy.visit(`/reports/${reportId}/`);
    cy.get(byTestId(CONTENT_TEST_ID), { timeout: READY_TIMEOUT }).should('be.visible');
    return this;
  }

  pageWidth(): Cypress.Chainable<LayoutWidth> {
    return cy.document().then((document) => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
  }

  timeline(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(byTestId(TIMELINE_SCROLLER_TEST_ID));
  }

  timelineWindows(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(byTestId(TIMELINE_WINDOW_TEST_ID));
  }

  timelineWidth(): Cypress.Chainable<LayoutWidth> {
    return this.timeline().then(($timeline) => ({
      scrollWidth: $timeline[0].scrollWidth,
      clientWidth: $timeline[0].clientWidth,
    }));
  }

  selectWindow(index: number): this {
    this.timelineWindows().eq(index).click();
    return this;
  }
}

export const reportDetailPage = new ReportDetailPage();
