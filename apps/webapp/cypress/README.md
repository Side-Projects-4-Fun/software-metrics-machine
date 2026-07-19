# Cypress E2E Testing with MSW

This directory contains Cypress end-to-end tests with MSW (Mock Service Worker) integration for mocking REST API responses.

## Setup

Cypress has been configured to work with the Next.js webapp and MSW for API mocking.

### Dependencies

- `cypress` - E2E testing framework
- `msw` - Mock Service Worker for API mocking
- `@cypress/webpack-preprocessor` - TypeScript support for Cypress

## Running Tests

### Start the Development Server

First, ensure your Next.js development server is running:

```bash
cd apps/webapp
pnpm dev
```

### Open Cypress Test Runner

```bash
cd apps/webapp
pnpm cy:open
```

### Run Tests in Headless Mode

```bash
cd apps/webapp
pnpm cy:run
```

## Directory Structure

```
cypress/
├── e2e/                    # E2E test files
│   └── dashboard.cy.ts    # Example dashboard tests
├── fixtures/              # Test fixtures (mock data)
│   └── example.json      # Example fixture
├── mocks/                # MSW mock handlers
│   └── handlers.ts       # API endpoint mocks
├── support/              # Support files
│   ├── commands.ts      # Custom Cypress commands
│   └── e2e.ts           # E2E setup and MSW initialization
└── README.md            # This file
```

## MSW Integration

MSW is automatically initialized in `cypress/support/e2e.ts` and provides mocked responses for REST API endpoints.

### Default Mocked Endpoints

The following endpoints are mocked in `cypress/mocks/handlers.ts`:

- `GET /api/metrics` - Mock metrics data
- `GET /api/projects` - Mock projects list
- `POST /api/configuration` - Mock configuration save
- `GET /api/pipelines` - Mock pipeline data
- `GET /api/pull-requests` - Mock pull request data
- `GET /api/source-code` - Mock source code metrics
- `GET /api/engineering-health` - Mock engineering health metrics
- `GET /api/sonarqube` - Mock SonarQube metrics
- `GET /api/jira` - Mock Jira data

### Using Custom Mocks in Tests

You can override or add custom mocks in individual tests:

```typescript
import { http, HttpResponse } from 'msw';

it('should test with custom mock', () => {
  // Override existing handler or add new one
  cy.mswUse(
    http.get('/api/custom-endpoint', () => {
      return HttpResponse.json({ data: 'custom response' });
    })
  );
  
  // Your test code
  cy.visit('/page');
  // ...
  
  // Reset to default handlers
  cy.mswResetHandlers();
});
```

## Writing Tests

### Basic Test Structure

```typescript
/// <reference types="cypress" />

describe('Page Name', () => {
  beforeEach(() => {
    cy.visit('/your-page');
  });

  it('should display expected content', () => {
    cy.contains('Expected Text').should('exist');
  });
});
```

### Testing with Mocked APIs

```typescript
it('should display data from mocked API', () => {
  cy.visit('/dashboard');
  
  // Verify mocked data is displayed
  cy.contains('Project A').should('exist');
  cy.contains('1234').should('exist');
});
```

### Custom Commands

The following custom commands are available:

- `cy.login(username, password)` - Mock login flow (when implemented)
- `cy.logout()` - Mock logout flow (when implemented)
- `cy.mswUse(...handlers)` - Add custom MSW handlers
- `cy.mswResetHandlers()` - Reset MSW handlers to defaults

## Configuration

Cypress is configured in `cypress.config.ts`:

- **Base URL**: `http://localhost:3000`
- **Viewport**: 1280x720
- **Spec Pattern**: `cypress/e2e/**/*.cy.{js,jsx,ts,tsx}`
- **Support File**: `cypress/support/e2e.ts`

## Best Practices

1. **Always mock APIs** - Use MSW to mock all API responses to ensure tests are reliable and fast
2. **Test user flows** - Focus on testing complete user workflows rather than implementation details
3. **Use data-testid** - Add `data-testid` attributes to elements for more reliable selectors
4. **Keep tests independent** - Each test should be able to run independently
5. **Use realistic data** - Mock data should resemble production data for more accurate testing

## Troubleshooting

### MSW Not Intercepting Requests

If MSW is not intercepting requests:
1. Check that the Next.js dev server is running
2. Verify MSW is initialized in the browser console (look for MSW messages)
3. Ensure the endpoint matches exactly what your app requests

### Tests Failing with Timeout

If tests are timing out:
1. Check that the dev server is running on the expected port (3000)
2. Verify your selectors are correct
3. Use `cy.wait()` sparingly - prefer using `cy.contains().should('exist')`

### TypeScript Errors

If you see TypeScript errors:
1. Ensure you have the `/// <reference types="cypress" />` at the top of test files
2. Restart your TypeScript server in your IDE

## Next Steps

1. Update the mock handlers in `cypress/mocks/handlers.ts` to match your actual API endpoints
2. Add more test files in `cypress/e2e/` for different pages and features
3. Add `data-testid` attributes to your React components for easier testing
4. Configure CI/CD to run Cypress tests in headless mode

## Resources

- [Cypress Documentation](https://docs.cypress.io/)
- [MSW Documentation](https://mswjs.io/)
- [Best Practices](https://docs.cypress.io/guides/references/best-practices)