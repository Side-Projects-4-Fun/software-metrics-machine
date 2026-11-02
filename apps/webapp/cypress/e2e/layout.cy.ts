/// <reference types="cypress" />

/**
 * Layout regression guard.
 *
 * Persistent MUI drawers keep their root element in the layout after they
 * close. The dashboard pulls the main content beneath those roots
 * (`marginRight: -410px` / `marginLeft: -280px`), so a closed drawer root used
 * to intercept clicks on the last cards. These journeys assert that content
 * underneath a closed drawer remains the hit target.
 */
describe('Layout drawers', () => {
  it('does not let the closed filters drawer block content clicks', () => {
    cy.visit('/dashboard/pipelines/');
    cy.get('[aria-label="close filters panel"]', { timeout: 30000 }).click();

    cy.document().then((doc) => {
      const view = doc.defaultView as Window;
      const roots = doc.querySelectorAll<HTMLElement>('.MuiDrawer-root');
      const rightDrawer = roots[roots.length - 1];
      const rect = rightDrawer.getBoundingClientRect();
      const hit = doc.elementFromPoint(rect.left + 10, view.innerHeight / 2);

      expect(getComputedStyle(rightDrawer).pointerEvents).to.equal('none');
      expect(rightDrawer.contains(hit)).to.equal(false);
      expect(hit?.tagName).not.to.equal('BODY');
    });
  });

  it('keeps the open filters drawer interactive', () => {
    cy.visit('/dashboard/pipelines/');

    cy.document().then((doc) => {
      const roots = doc.querySelectorAll<HTMLElement>('.MuiDrawer-root');
      const rightDrawer = roots[roots.length - 1];

      expect(getComputedStyle(rightDrawer).pointerEvents).to.equal('auto');
    });
  });
});
