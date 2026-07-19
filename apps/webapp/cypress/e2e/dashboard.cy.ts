/// <reference types="cypress" />
import { http, HttpResponse } from 'msw';

describe('Dashboard Page', () => {
  beforeEach(() => {
    // Visit the dashboard page
    cy.visit('/dashboard');
  });

  it('should display the dashboard page with mocked metrics', () => {
    // Verify page title
    cy.title().should('include', 'Dashboard');

    // Verify that mocked API data is displayed
    // These assertions should be adjusted based on your actual UI
    cy.contains('totalCommits').should('exist');
    cy.contains('1234').should('exist');
  });

  it('should load projects from mocked API', () => {
    // Navigate to projects section or page
    cy.visit('/dashboard');

    // Verify mocked projects data
    cy.contains('Project A').should('exist');
    cy.contains('Project B').should('exist');
  });

  it('should handle API errors gracefully', () => {
    // Test error handling by modifying mock response
    cy.mswUse(
      http.get('/api/metrics', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    cy.visit('/dashboard');
    cy.contains('error').should('exist');
    cy.mswResetHandlers();
  });

  it('should display pipelines data', () => {
    cy.visit('/dashboard/pipelines');
    
    // Verify mocked pipeline data
    cy.contains('CI Pipeline').should('exist');
    cy.contains('CD Pipeline').should('exist');
  });

  it('should display pull requests data', () => {
    cy.visit('/dashboard/pull-requests');
    
    // Verify mocked PR data
    cy.contains('Feature X').should('exist');
    cy.contains('Bug fix Y').should('exist');
  });

  it('should display engineering health metrics', () => {
    cy.visit('/dashboard/engineering-health');
    
    // Verify mocked health data
    cy.contains('Code Quality').should('exist');
    cy.contains('Delivery Speed').should('exist');
  });

  it('should display source code metrics', () => {
    cy.visit('/dashboard/source-code');
    
    // Verify mocked source code data
    cy.contains('TypeScript').should('exist');
    cy.contains('JavaScript').should('exist');
  });
});

describe('Settings Page', () => {
  it('should save configuration with mocked API', () => {
    cy.visit('/dashboard/settings');
    
    // Interact with form elements
    cy.get('input[name="projectName"]').type('Test Project');
    
    // Mock successful POST request
    cy.mswUse(
      http.post('/api/configuration', () => {
        return HttpResponse.json({
          success: true,
          message: 'Configuration saved successfully',
        });
      })
    );
    
    // Submit form
    cy.get('button[type="submit"]').click();
    
    // Verify success message
    cy.contains('Configuration saved successfully').should('exist');
    
    // Reset handlers for next test
    cy.mswResetHandlers();
  });
});
