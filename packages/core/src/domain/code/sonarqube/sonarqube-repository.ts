import { SonarqubeComponentMeasure } from '../../..';
import {
  CodeMetric,
  SonarqubeComponentTreeMeasure,
  SonarqubeMeasure,
  TimestampedEntry,
} from '../../../providers/sonarqube';

export type SonarqubeMeasureFilters = {
  measures?: string | string[];
};

export type SonarqubeComponentTreeFilters = {
  component?: string;
  depth?: number;
  metrics?: string | string[];
  ignore_files?: string | string[];
  include_files?: string | string[];
  remove_folders?: boolean;
};

export interface SonarqubeRepository {
  loadAll(options?: SonarqubeMeasureFilters | string[]): Promise<SonarqubeComponentMeasure | null>;

  loadMeasurements(options?: SonarqubeMeasureFilters | string[]): Promise<SonarqubeMeasure[]>;

  loadAllMeasurementEntries(): Promise<TimestampedEntry<SonarqubeMeasure[]>[]>;

  loadComponentTree(
    options?: SonarqubeComponentTreeFilters
  ): Promise<SonarqubeComponentTreeMeasure[]>;

  loadAllComponentTreeEntries(
    options?: SonarqubeComponentTreeFilters
  ): Promise<TimestampedEntry<SonarqubeComponentTreeMeasure[]>[]>;

  loadHistoricalMeasures(options?: SonarqubeMeasureFilters | string[]): Promise<CodeMetric[]>;

  loadCoverageHistory(): Promise<CodeMetric[]>;

  loadAllHistoricalMeasureEntries(
    options?: SonarqubeMeasureFilters | string[]
  ): Promise<TimestampedEntry<CodeMetric[]>[]>;
}
