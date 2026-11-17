import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { MetricsModule } from './metrics.module';
import { HttpExceptionFilter, AllExceptionsFilter } from './filters/http-exception.filter';
import { setupSwagger } from './config/swagger.config';
import { SmmNestLogger } from './logger/smm-nest-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(MetricsModule);
  app.useLogger(new SmmNestLogger('Bootstrap'));
  const logger = new SmmNestLogger('SoftwareMetricsMachine');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors): BadRequestException => {
        const message = errors
          .map((error) => {
            const constraints = Object.values(error.constraints || {});
            return `${error.property}: ${constraints.join(', ')}`;
          })
          .join('; ');
        return new BadRequestException(message);
      },
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new AllExceptionsFilter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  setupSwagger(app);

  const port = process.env.PORT || 3000;
  const environment = process.env.NODE_ENV || 'development';

  await app.listen(port);

  logger.log(`╔════════════════════════════════════════════════════════╗`);
  logger.log(`║  Software Metrics Machine - REST API                   ║`);
  logger.log(`╚════════════════════════════════════════════════════════╝`);
  logger.log(`Environment: ${environment}`);
  logger.log(`Server running on port ${port}`);
  logger.log(``);
  logger.log(`Documentation:`);
  logger.log(`  🔗 Swagger UI: http://localhost:${port}/api/docs`);
  logger.log(`  📋 OpenAPI JSON: http://localhost:${port}/api-json`);
  logger.log(``);
  logger.log(`API Endpoints:`);
  logger.log(`  📊 Change Request Metrics`);
  logger.log(`     GET /api/metrics/change-requests?startDate=2024-01-01&endDate=2024-12-31`);
  logger.log(``);
  logger.log(`  🚀 Deployment Metrics`);
  logger.log(`     GET /api/metrics/deployment?frequency=week`);
  logger.log(``);
  logger.log(`  💻 Code Metrics`);
  logger.log(`     GET /api/metrics/code?selectedAuthors=Alice&selectedAuthors=Bob`);
  logger.log(``);
  logger.log(`  🎫 Issue Metrics`);
  logger.log(`     GET /api/metrics/issues?status=Done`);
  logger.log(``);
  logger.log(`  ✅ Quality Metrics`);
  logger.log(`     GET /api/metrics/quality?measures=coverage&measures=complexity`);
  logger.log(``);
  logger.log(`  📑 Complete Report`);
  logger.log(`     GET /api/metrics/report`);
  logger.log(``);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
