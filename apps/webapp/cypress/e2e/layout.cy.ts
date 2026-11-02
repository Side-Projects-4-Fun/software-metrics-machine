/// <reference types="cypress" />

import { appShellPage } from '../pages/app-shell.page';

/**
 * Layout regression guard.
 *
 * Persistent MUI drawers keep their root element in the layout after they
 * close. The dashboard pulls the main content beneath those roots
 * (`marginRight: -410px` / `marginLeft: -280px`), so a closed drawer root used
 * to intercept clicks on the last cards.
 *
 * Each journey starts from a route whose initial layout already contains the
 * state under test, then hit-tests the drawer edge: content must receive the
 * click when the drawer is closed, and the drawer must own it when open. Opening
 * and closing the panels is covered by `__tests__/app-shell.test.tsx`.
 */
describe('Layout drawers', () => {
  it('does not let the closed filters drawer block content clicks', () => {
    appShellPage.visitEngineeringHealth();

    appShellPage.drawerPointerEvents('filters').then((pointerEvents) => {
      expect(pointerEvents, 'closed filters drawer pointer-events').to.equal('none');
    });

    appShellPage.hitTestAtDrawerEdge('filters').then((hitTest) => {
      expect(hitTest.hit, 'element under the closed filters drawer').not.to.equal(null);
      expect(hitTest.hitIsInsideDrawer, 'closed drawer intercepts the click').to.equal(false);
      expect(hitTest.hitIsInsideContent, 'content receives the click').to.equal(true);
    });
  });

  it('keeps the open filters drawer interactive', () => {
    appShellPage.visitPipelines();

    appShellPage.drawerPointerEvents('filters').then((pointerEvents) => {
      expect(pointerEvents, 'open filters drawer pointer-events').to.equal('auto');
    });

    appShellPage.hitTestAtDrawerEdge('filters').then((hitTest) => {
      expect(hitTest.hit, 'element inside the open filters drawer').not.to.equal(null);
      expect(hitTest.hitIsInsideDrawer, 'open drawer owns the click').to.equal(true);
    });
  });
});
