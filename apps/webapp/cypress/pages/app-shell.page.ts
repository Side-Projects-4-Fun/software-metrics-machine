/**
 * Page object for the application shell shared by every dashboard route.
 *
 * Contract: specs name intent (`drawerPointerEvents('filters')`,
 * `hitTestAtDrawerEdge('filters')`) and this file owns the DOM details. Elements
 * are located only through the `data-testid` attributes rendered by the app — no
 * CSS classes, MUI internals or text matching leak into specs.
 *
 * The persistent drawers are rendered server-side with their `pointer-events`
 * guard already applied, so the hit-testing journeys read the initial layout
 * instead of driving React state. To test a panel in its open or closed state,
 * visit a route whose layout starts that way (`visitPipelines` vs
 * `visitEngineeringHealth`); the open/close transitions themselves are covered
 * by the Jest tests in `__tests__/app-shell.test.tsx`.
 */

type DrawerName = 'projects' | 'filters';

/** Drawers rendered by `components/layout/AppShell.tsx`, with the edge the page content extends under. */
const DRAWERS: Record<DrawerName, { testId: string; innerEdge: 'left' | 'right' }> = {
  projects: { testId: 'projects-drawer', innerEdge: 'right' },
  filters: { testId: 'filters-drawer', innerEdge: 'left' },
};

const CONTENT_TEST_ID = 'dashboard-content';

/** Distance from the drawer edge used for hit-testing, in pixels. */
const HIT_TEST_EDGE_OFFSET = 10;

/** Next.js compiles a route on first request, which is slower than a warm app. */
const READY_TIMEOUT = 30_000;

export interface DrawerHitTest {
  /** Element returned by `document.elementFromPoint` at the drawer edge. */
  hit: Element | null;
  /** Whether the hit target belongs to the drawer itself. */
  hitIsInsideDrawer: boolean;
  /** Whether the hit target belongs to the page content the drawer overlays. */
  hitIsInsideContent: boolean;
}

const byTestId = (testId: string): string => `[data-testid="${testId}"]`;

export class AppShellPage {
  /**
   * Opens the pipeline dashboard, whose filters panel starts open.
   */
  visitPipelines(): this {
    return this.visit('/dashboard/pipelines/');
  }

  /**
   * Opens the engineering health report, whose layout starts with the filters
   * panel closed (`initialFiltersOpen={false}`).
   */
  visitEngineeringHealth(): this {
    return this.visit('/engineering-health/');
  }

  content(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(byTestId(CONTENT_TEST_ID));
  }

  drawer(name: DrawerName): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(byTestId(DRAWERS[name].testId));
  }

  drawerPointerEvents(name: DrawerName): Cypress.Chainable<string> {
    return this.drawer(name).then(($drawer) => {
      return getComputedStyle($drawer[0]).pointerEvents;
    });
  }

  /**
   * Hit-tests the drawer's inner edge, where the page content extends beneath
   * it. A closed drawer must leave the content clickable there; an open drawer
   * must own the click itself.
   */
  hitTestAtDrawerEdge(name: DrawerName): Cypress.Chainable<DrawerHitTest> {
    return this.drawer(name).then(($drawer) => {
      const drawerElement = $drawer[0];
      const rect = drawerElement.getBoundingClientRect();
      const x = DRAWERS[name].innerEdge === 'left'
        ? rect.left + HIT_TEST_EDGE_OFFSET
        : rect.right - HIT_TEST_EDGE_OFFSET;

      return cy.window().then((win) => {
        const hit = win.document.elementFromPoint(x, win.innerHeight / 2);
        const contentElement = win.document.querySelector(byTestId(CONTENT_TEST_ID));

        return {
          hit,
          hitIsInsideDrawer: hit ? drawerElement.contains(hit) : false,
          hitIsInsideContent: hit && contentElement ? contentElement.contains(hit) : false,
        };
      });
    });
  }

  private visit(path: string): this {
    cy.visit(path);
    cy.get(byTestId(CONTENT_TEST_ID), { timeout: READY_TIMEOUT }).should('be.visible');
    return this;
  }
}

export const appShellPage = new AppShellPage();
