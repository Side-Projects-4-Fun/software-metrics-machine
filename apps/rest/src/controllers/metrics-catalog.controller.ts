import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  listMetricCatalogEntries,
  isMetricNamespace,
  isMetricVisibility,
  METRIC_NAMESPACES,
  METRIC_VISIBILITIES,
  type MetricCatalogEntry,
  type MetricNamespace,
  type MetricVisibility,
} from '@smmachine/core';

/**
 * Metrics Catalog REST Controller
 *
 * Exposes the static metric catalog. It has no data dependencies, so it works
 * even when no project or datastore is configured.
 */
@ApiTags('Metrics')
@Controller()
export class MetricsCatalogController {
  @Get('/metrics')
  @ApiQuery({
    name: 'namespace',
    required: false,
    enum: [...METRIC_NAMESPACES],
    description: 'Filter by metric namespace.',
  })
  @ApiQuery({
    name: 'visibility',
    required: false,
    enum: [...METRIC_VISIBILITIES],
    description: 'Filter by metric visibility.',
  })
  list(
    @Query('namespace') namespace?: string,
    @Query('visibility') visibility?: string
  ): { result: MetricCatalogEntry[] } {
    return {
      result: listMetricCatalogEntries({
        namespace: this.resolveNamespace(namespace),
        visibility: this.resolveVisibility(visibility),
      }),
    };
  }

  private resolveNamespace(value?: string): MetricNamespace | undefined {
    if (value === undefined || value.length === 0) {
      return undefined;
    }

    if (!isMetricNamespace(value)) {
      throw new BadRequestException(
        `Invalid namespace "${value}". Supported: ${METRIC_NAMESPACES.join(', ')}`
      );
    }

    return value;
  }

  private resolveVisibility(value?: string): MetricVisibility | undefined {
    if (value === undefined || value.length === 0) {
      return undefined;
    }

    if (!isMetricVisibility(value)) {
      throw new BadRequestException(
        `Invalid visibility "${value}". Supported: ${METRIC_VISIBILITIES.join(', ')}`
      );
    }

    return value;
  }
}
