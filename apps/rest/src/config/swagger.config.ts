import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { getApplicationVersion } from '@smmachine/utils';

/**
 * Configure Swagger/OpenAPI documentation for the REST API
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Software Metrics Machine API')
    .setDescription(
      `
REST API for software metrics collection and analysis.
Provides comprehensive metrics from GitHub, Jira, SonarQube, Git repositories, and CodeMaat.

## Features

- **Pull Request Metrics**: Analyze PR metrics including lead time and comments
- **Deployment Metrics**: Track deployment frequency and job performance
- **Code Metrics**: Get pairing index, code churn, and file coupling data
- **Issue Metrics**: Query Jira issue data and metrics
- **Quality Metrics**: Retrieve code quality data from SonarQube
- **Complete Reports**: Get comprehensive metrics across all sources

## Authentication

Current version does not require authentication. Authentication will be added in future versions.

## Query Parameters

All endpoints support optional filtering:
- \`startDate\`: Start date or datetime in ISO 8601 format
- \`endDate\`: End date or datetime in ISO 8601 format
- \`timezone\`: Browser IANA timezone used by REST date grouping and date-only filtering

## Response Format

All responses include:
- \`filters\`: Applied query filters
- Metric-specific data structures

## Error Handling

Errors return HTTP status codes with JSON error response:
\`\`\`json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "BadRequest",
  "timestamp": "2024-03-29T10:30:00.000Z",
  "path": "/api/metrics/pr"
}
\`\`\`
      `
    )
    .setVersion(getApplicationVersion())
    .addTag('Metrics', 'All metrics endpoints')
    .addServer(`http://localhost:${process.env.PORT}`, 'Development')
    .addServer('https://api.metrics.example.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customCss: undefined,
    customSiteTitle: 'SMM API Documentation',
    url: '/api-json',
  });
}
