import 'reflect-metadata';
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { METRIC_CATALOG } from '@smmachine/core';
import { MetricsModule } from '../src/metrics.module';

type ControllerClass = { prototype: object };

/**
 * Routes that are deliberately not metric surfaces. Every other route must be
 * catalogued; adding a new route forces a decision here.
 */
const NON_METRIC_REST_ROUTES = new Set<string>([
  // Infrastructure and configuration.
  '/version',
  '/configuration',
  '/projects',
  '/filters',
  // Catalog discovery.
  '/metrics',
  // Filter-option endpoints.
  '/change-requests/filter-options',
  '/pipelines/workflows',
  '/pipelines/statuses',
  '/pipelines/conclusions',
  '/pipelines/branches',
  '/pipelines/events',
  '/pipelines/jobs',
  '/pipelines/filter-options',
  '/code/authors',
  // Composite report aggregator.
  '/api/metrics/report',
]);

function joinPaths(base: string | undefined, path: string): string {
  const normalizedBase =
    base === undefined || base === '/' || base === '' ? '' : `/${base.replace(/^\/|\/$/g, '')}`;
  const normalizedPath =
    path === '/' || path.length === 0 ? '' : `/${path.replace(/^\/|\/$/g, '')}`;
  const joined = `${normalizedBase}${normalizedPath}`;

  return joined.length === 0 ? '/' : joined;
}

function controllerRoutes(): string[] {
  const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, MetricsModule) as
    ControllerClass[] | undefined;

  if (!controllers) {
    return [];
  }

  return controllers.flatMap((controller) => {
    const basePath = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
    const prototype = controller.prototype as Record<string, unknown>;

    return Object.getOwnPropertyNames(prototype)
      .filter((methodName) => methodName !== 'constructor')
      .map((methodName) => prototype[methodName])
      .filter((value): value is (...args: never[]) => unknown => typeof value === 'function')
      .map((handler) => Reflect.getMetadata(PATH_METADATA, handler) as string | undefined)
      .filter((path): path is string => typeof path === 'string')
      .map((path) => joinPaths(basePath, path));
  });
}

function uniqueControllerRoutes(): string[] {
  return Array.from(new Set(controllerRoutes()));
}

function catalogRestRoutes(): string[] {
  return Object.values(METRIC_CATALOG).flatMap((definition) => definition.surfaces.rest ?? []);
}

function missingRestRoutes(): string[] {
  const routes = new Set(uniqueControllerRoutes());

  return catalogRestRoutes().filter((route) => !routes.has(route));
}

function uncataloguedRestRoutes(): string[] {
  const catalogued = new Set(catalogRestRoutes());

  return uniqueControllerRoutes().filter(
    (route) => !catalogued.has(route) && !NON_METRIC_REST_ROUTES.has(route)
  );
}

function staleAllowlistEntries(): string[] {
  return catalogRestRoutes().filter((route) => NON_METRIC_REST_ROUTES.has(route));
}

describe('metric catalog REST coverage', () => {
  it('exposes every catalogued REST route', () => {
    expect(missingRestRoutes()).toEqual([]);
  });

  it('classifies every route as metric or explicitly non-metric', () => {
    expect(uncataloguedRestRoutes()).toEqual([]);
  });

  it('does not allowlist a route that is actually catalogued', () => {
    expect(staleAllowlistEntries()).toEqual([]);
  });

  it('exposes GET /metrics', () => {
    expect(uniqueControllerRoutes()).toContain('/metrics');
  });
});
