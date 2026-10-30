import type { ChangeRequestEvaluationService } from '../change-requests/services/change-request-evaluation-service';
import type { ChangeRequestsService } from '../change-requests/services/change-requests-service';
import type { ArchitectureEvaluationService } from '../architecture/architecture-evaluation-service';
import type { ArchitectureService } from '../architecture/architecture-service';
import type { BigOService } from '../code/big-o/big-o-service';
import type { CodeEvaluationService } from '../code/code-evaluation-service';
import type { CodemaatService } from '../code/codemaat/codemaat-service';
import type { ICodeMetricsRepository } from '../code/codemaat/repositories/codemaat-metrics-repository';
import type { PairingService } from '../code/pairing/pairing-service';
import type { SonarqubeEvaluationService } from '../code/sonarqube/sonarqube-evaluation-service';
import type { IssuesRepository } from '../issues/issues-repository-json';
import type { PipelineEvaluationService } from '../pipelines/services/pipeline-evaluation-service';
import type { PipelineImplementation } from '../pipelines/services/pipeline-implementation';
import type { PipelinesService } from '../pipelines/services/pipelines-service';
import type { SonarqubeRepositoryJson } from '../../providers/sonarqube/repositories/sonarqube-repository-json';
import type {
  ComponentsMetric,
  CouplingMetric,
  OwnershipMetric,
} from '../../engineering-health/adapters/architecture';
import type {
  KnowledgeDistributionMetric,
  PairProgrammingMetric,
  ReviewParticipationMetric,
  ReviewTimeMetric,
} from '../../engineering-health/adapters/collaboration';
import type {
  DeploymentFrequencyMetric,
  FailureRateMetric,
  LeadTimeMetric,
  PipelineDurationMetric,
} from '../../engineering-health/adapters/delivery';
import type {
  ComplexityMetric,
  CoverageMetric,
  DuplicationMetric,
} from '../../engineering-health/adapters/quality';
import type { CatalogMetricId } from './metric-catalog';

/**
 * Runtime types that back the catalog. Adding a service here makes its public
 * methods addressable by `METRIC_IMPLEMENTATIONS`; it does not change the
 * catalog itself.
 */
export interface MetricServiceRegistry {
  ChangeRequestsService: ChangeRequestsService;
  ChangeRequestEvaluationService: ChangeRequestEvaluationService;
  PipelineImplementation: PipelineImplementation;
  PipelinesService: PipelinesService;
  PipelineEvaluationService: PipelineEvaluationService;
  CodemaatService: CodemaatService;
  CodeMaatMetricsRepository: ICodeMetricsRepository;
  PairingService: PairingService;
  BigOService: BigOService;
  CodeEvaluationService: CodeEvaluationService;
  SonarqubeRepository: SonarqubeRepositoryJson;
  SonarqubeEvaluationService: SonarqubeEvaluationService;
  ArchitectureService: ArchitectureService;
  ArchitectureEvaluationService: ArchitectureEvaluationService;
  IssuesRepository: IssuesRepository;
  DeploymentFrequencyMetric: DeploymentFrequencyMetric;
  LeadTimeMetric: LeadTimeMetric;
  PipelineDurationMetric: PipelineDurationMetric;
  FailureRateMetric: FailureRateMetric;
  ComplexityMetric: ComplexityMetric;
  DuplicationMetric: DuplicationMetric;
  CoverageMetric: CoverageMetric;
  ReviewTimeMetric: ReviewTimeMetric;
  ReviewParticipationMetric: ReviewParticipationMetric;
  PairProgrammingMetric: PairProgrammingMetric;
  KnowledgeDistributionMetric: KnowledgeDistributionMetric;
  CouplingMetric: CouplingMetric;
  OwnershipMetric: OwnershipMetric;
  ComponentsMetric: ComponentsMetric;
}

/**
 * A valid service/method pair. `method` is narrowed to the public members of
 * the service selected by `service`, so a typo in either name fails the build.
 */
export type MetricMethodReference = {
  [TService in keyof MetricServiceRegistry]: {
    readonly service: TService;
    readonly method: keyof MetricServiceRegistry[TService];
  };
}[keyof MetricServiceRegistry];

/**
 * Maps every catalog ID to the service method that produces it.
 *
 * The mapping is declarative and type-checked; nothing is discovered at
 * runtime. `Record<MetricId, ...>` also makes an incomplete map a compile
 * error.
 */
export const METRIC_IMPLEMENTATIONS = {
  // Change requests
  'cr-summary': { service: 'ChangeRequestsService', method: 'getSummary' },
  'cr-metrics': { service: 'ChangeRequestsService', method: 'getMetrics' },
  'cr-throughput': { service: 'ChangeRequestsService', method: 'getThroughTime' },
  'cr-volume-by-author': { service: 'ChangeRequestsService', method: 'getByAuthor' },
  'cr-review-time': { service: 'ChangeRequestsService', method: 'getReviewTime' },
  'cr-open-time': { service: 'ChangeRequestsService', method: 'getOpenTimeBy' },
  'cr-comments-per-cr': { service: 'ChangeRequestsService', method: 'getMetrics' },
  'cr-comments-by-author': { service: 'ChangeRequestsService', method: 'getCommentsByAuthor' },
  'cr-first-comment-time': { service: 'ChangeRequestsService', method: 'getFirstCommentTime' },
  'cr-metrics-by-week': { service: 'ChangeRequestsService', method: 'getMetricsByWeek' },
  'cr-metrics-by-month': { service: 'ChangeRequestsService', method: 'getMetricsByMonth' },
  'cr-label-summary': { service: 'ChangeRequestsService', method: 'getLabelSummaries' },
  'cr-evaluation': { service: 'ChangeRequestEvaluationService', method: 'evaluate' },

  // Pipelines
  'pl-summary': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-status-counts': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-job-status-counts': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-run-duration': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-runs-over-time': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-jobs-summary': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-job-duration': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-job-duration-by-day': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-job-steps-duration': { service: 'PipelinesService', method: 'getJobStepsTime' },
  'pl-job-steps-duration-by-day': { service: 'PipelinesService', method: 'getJobStepsTimeByDay' },
  'pl-reruns-by-day': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-jobs-duration-by-workflow': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-deployment-frequency': {
    service: 'PipelinesService',
    method: 'getDeploymentFrequencyWithAllIntervals',
  },
  'pl-lead-time': { service: 'PipelineImplementation', method: 'dashboard' },
  'pl-evaluation': { service: 'PipelineEvaluationService', method: 'evaluate' },

  // Code
  'code-big-o': { service: 'BigOService', method: 'listFiles' },
  'code-summary': { service: 'PairingService', method: 'getPairingIndex' },
  'code-churn': { service: 'CodemaatService', method: 'getCodeChurn' },
  'code-author-churn': { service: 'CodemaatService', method: 'getAuthorChurn' },
  'code-coupling': { service: 'CodemaatService', method: 'getFileCoupling' },
  'code-layered-coupling': { service: 'CodeMaatMetricsRepository', method: 'getLayeredCoupling' },
  'code-entity-churn': { service: 'CodeMaatMetricsRepository', method: 'getEntityChurn' },
  'code-entity-effort': { service: 'CodemaatService', method: 'getEntityEffort' },
  'code-entity-ownership': { service: 'CodemaatService', method: 'getEntityOwnership' },
  'code-pairing-index': { service: 'PairingService', method: 'getPairingIndex' },
  'code-crap': { service: 'CodeEvaluationService', method: 'evaluate' },
  'code-churn-history': { service: 'CodeMaatMetricsRepository', method: 'getCodeChurnHistory' },
  'code-coupling-history': {
    service: 'CodeMaatMetricsRepository',
    method: 'getFileCouplingHistory',
  },
  'code-layered-coupling-history': {
    service: 'CodeMaatMetricsRepository',
    method: 'getLayeredCouplingHistory',
  },
  'code-entity-churn-history': {
    service: 'CodeMaatMetricsRepository',
    method: 'getEntityChurnHistory',
  },
  'code-entity-effort-history': {
    service: 'CodeMaatMetricsRepository',
    method: 'getEntityEffortHistory',
  },
  'code-entity-ownership-history': {
    service: 'CodeMaatMetricsRepository',
    method: 'getEntityOwnershipHistory',
  },
  'code-evaluation': { service: 'CodeEvaluationService', method: 'evaluate' },

  // Quality
  'sq-coverage': { service: 'SonarqubeRepository', method: 'loadAll' },
  'sq-maintainability-rating': { service: 'SonarqubeRepository', method: 'loadAll' },
  'sq-reliability-rating': { service: 'SonarqubeEvaluationService', method: 'evaluate' },
  'sq-security-rating': { service: 'SonarqubeEvaluationService', method: 'evaluate' },
  'sq-complexity': { service: 'SonarqubeRepository', method: 'loadAll' },
  'sq-cognitive-complexity': { service: 'SonarqubeRepository', method: 'loadComponentTree' },
  'sq-duplication-density': { service: 'SonarqubeRepository', method: 'loadAll' },
  'sq-ncloc': { service: 'SonarqubeRepository', method: 'loadAll' },
  'sq-code-smells': { service: 'SonarqubeRepository', method: 'loadAll' },
  'sq-bugs': { service: 'SonarqubeRepository', method: 'loadAll' },
  'sq-component-tree': { service: 'SonarqubeRepository', method: 'loadComponentTree' },
  'sq-component-tree-history': {
    service: 'SonarqubeRepository',
    method: 'loadAllComponentTreeEntries',
  },
  'sq-measurements': { service: 'SonarqubeRepository', method: 'loadMeasurements' },
  'sq-measurements-history': {
    service: 'SonarqubeRepository',
    method: 'loadAllMeasurementEntries',
  },
  'sq-evaluation': { service: 'SonarqubeEvaluationService', method: 'evaluate' },

  // Architecture
  'arch-snapshot': { service: 'ArchitectureService', method: 'listSnapshots' },
  'arch-summary': { service: 'ArchitectureService', method: 'getSnapshot' },
  'arch-view': { service: 'ArchitectureService', method: 'getView' },
  'arch-container-count': { service: 'ArchitectureEvaluationService', method: 'evaluate' },
  'arch-dependency-concentration': { service: 'ArchitectureEvaluationService', method: 'evaluate' },
  'arch-hub-dependency': { service: 'ArchitectureEvaluationService', method: 'evaluate' },
  'arch-orphan-nodes': { service: 'ArchitectureEvaluationService', method: 'evaluate' },
  'arch-confidence-health': { service: 'ArchitectureEvaluationService', method: 'evaluate' },
  'arch-evaluation': { service: 'ArchitectureEvaluationService', method: 'evaluate' },

  // Issues
  'issue-total': { service: 'IssuesRepository', method: 'getIssues' },
  'issue-list': { service: 'IssuesRepository', method: 'getIssues' },

  // Engineering health
  'deployment-frequency': { service: 'DeploymentFrequencyMetric', method: 'calculate' },
  'lead-time': { service: 'LeadTimeMetric', method: 'calculate' },
  'pipeline-duration': { service: 'PipelineDurationMetric', method: 'calculate' },
  'failure-rate': { service: 'FailureRateMetric', method: 'calculate' },
  complexity: { service: 'ComplexityMetric', method: 'calculate' },
  duplication: { service: 'DuplicationMetric', method: 'calculate' },
  coverage: { service: 'CoverageMetric', method: 'calculate' },
  'review-time': { service: 'ReviewTimeMetric', method: 'calculate' },
  'review-participation': { service: 'ReviewParticipationMetric', method: 'calculate' },
  'pair-programming': { service: 'PairProgrammingMetric', method: 'calculate' },
  'knowledge-distribution': { service: 'KnowledgeDistributionMetric', method: 'calculate' },
  coupling: { service: 'CouplingMetric', method: 'calculate' },
  ownership: { service: 'OwnershipMetric', method: 'calculate' },
  components: { service: 'ComponentsMetric', method: 'calculate' },
} as const satisfies Record<CatalogMetricId, MetricMethodReference>;

type Equal<TLeft, TRight> =
  (<TType>() => TType extends TLeft ? 1 : 2) extends <TType>() => TType extends TRight ? 1 : 2
    ? true
    : false;
type Expect<TValue extends true> = TValue;

/**
 * Compile-time guarantee that the implementation map and the catalog have the
 * same keys. A missing or orphan binding makes this type fail to resolve.
 */
export type MetricImplementationCoverage = Expect<
  Equal<keyof typeof METRIC_IMPLEMENTATIONS, CatalogMetricId>
>;
