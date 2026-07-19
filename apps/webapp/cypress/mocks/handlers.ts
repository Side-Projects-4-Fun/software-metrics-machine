import { http, HttpResponse } from 'msw';

// Example mock handlers for REST API endpoints
// These can be expanded based on your actual API endpoints

export const handlers = [
  // Example: Mock GET /api/metrics
  http.get('/api/metrics', () => {
    return HttpResponse.json({
      data: {
        totalCommits: 1234,
        totalPullRequests: 56,
        totalIssues: 78,
        codeCoverage: 85.5,
      },
    });
  }),

  // Example: Mock GET /api/projects
  http.get('/api/projects', () => {
    return HttpResponse.json({
      data: [
        { id: 1, name: 'Project A', url: 'https://github.com/org/project-a' },
        { id: 2, name: 'Project B', url: 'https://github.com/org/project-b' },
      ],
    });
  }),

  // Example: Mock POST /api/configuration
  http.post('/api/configuration', () => {
    return HttpResponse.json({
      success: true,
      message: 'Configuration saved successfully',
    });
  }),

  // Example: Mock GET /api/pipelines
  http.get('/api/pipelines', () => {
    return HttpResponse.json({
      data: [
        { id: 1, name: 'CI Pipeline', status: 'success', duration: 120 },
        { id: 2, name: 'CD Pipeline', status: 'pending', duration: 45 },
      ],
    });
  }),

  // Example: Mock GET /api/pull-requests
  http.get('/api/pull-requests', () => {
    return HttpResponse.json({
      data: [
        { id: 1, title: 'Feature X', status: 'open', author: 'user1' },
        { id: 2, title: 'Bug fix Y', status: 'merged', author: 'user2' },
      ],
    });
  }),

  // Example: Mock GET /api/source-code
  http.get('/api/source-code', () => {
    return HttpResponse.json({
      data: {
        totalFiles: 234,
        totalLines: 45678,
        languages: [
          { name: 'TypeScript', percentage: 45 },
          { name: 'JavaScript', percentage: 30 },
          { name: 'Python', percentage: 25 },
        ],
      },
    });
  }),

  // Example: Mock GET /api/engineering-health
  http.get('/api/engineering-health', () => {
    return HttpResponse.json({
      data: {
        overallHealth: 85,
        factors: [
          { name: 'Code Quality', score: 90 },
          { name: 'Delivery Speed', score: 80 },
          { name: 'Team Satisfaction', score: 85 },
        ],
      },
    });
  }),

  // Example: Mock GET /api/sonarqube
  http.get('/api/sonarqube', () => {
    return HttpResponse.json({
      data: {
        bugs: 5,
        vulnerabilities: 2,
        codeSmells: 15,
        coverage: 85.5,
        duplications: 3.2,
      },
    });
  }),

  // Example: Mock GET /api/jira
  http.get('/api/jira', () => {
    return HttpResponse.json({
      data: {
        totalIssues: 123,
        openIssues: 45,
        inProgress: 23,
        resolved: 55,
      },
    });
  }),

  // Mock for unhandled routes - you can customize this
  http.all('*', ({ request }) => {
    console.warn(`Unhandled request: ${request.method} ${request.url}`);
    return HttpResponse.json(
      { error: 'Not Found', message: `Route not found: ${request.url}` },
      { status: 404 }
    );
  }),
];