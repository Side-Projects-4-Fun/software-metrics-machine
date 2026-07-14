import { defaultFilters, parseDashboardFilters } from "@/components/filters/DashboardFilters";
import { sonarqubeAPI, sourceCodeAPI } from '@/server/api';
import type { SonarqubeComponentMeasure } from '@/server/api/sonarqube';
import { buildSonarqubeApiParams, buildSourceCodeApiParams } from '@/server/utils/apiParams';
import { ensureArray } from '@/server/utils/chartData';
import EntityChurnCard from '@/components/charts/source-code/EntityChurnCard';
import EntityEffortCard from '@/components/charts/source-code/EntityEffortCard';
import CodeChurnOverTimeCard from '@/components/charts/source-code/CodeChurnOverTimeCard';
import EntityOwnershipCard from '@/components/charts/source-code/EntityOwnershipCard';
import CodeCouplingCard from '@/components/charts/source-code/CodeCouplingCard';
import LayeredCouplingClusterCard from '@/components/charts/source-code/LayeredCouplingClusterCard';
import CrapMetricCard from '@/components/charts/source-code/CrapMetricCard';
import { calculateCrapScore } from '@/components/charts/source-code/crap-metric';
import EntityEffortTreemap from '@/components/entity-effort-treemap';
import {
  CodeChurnData,
  CouplingData,
  CrapMetricData,
  EntityChurnData,
  EntityEffortData,
  EntityOwnershipData,
  LayeredCouplingData,
} from '@/components/charts/source-code/types';
import { LatestPairedCommitsCard } from "@/components/charts/source-code/LatestPairedCommitsCard";
import { TopPairingsCard } from '@/components/charts/source-code/TopPairingsCard';
import { BigOAnalysisCard } from '@/components/charts/source-code/BigOAnalysisCard';
import type { BigOFileSummary as BigOFileSummaryResponse } from '@/server/api/sourceCode';

type ResultWrapper<T> = {
  result: T;
};

type PairingIndexResponse = {
  pairing_index_percentage: number;
  total_analyzed_commits: number;
  paired_commits: number;
  top_pairs?: Array<{ author: string; co_author: string; paired_commits: number }>;
  latest_paired_commits?: Array<{
    hash: string;
    author: string;
    co_authors: string[];
    timestamp: string;
    subject: string;
  }>;
};

function unwrapResult<T>(data: T | ResultWrapper<T>): T {
  if (typeof data === 'object' && data !== null && 'result' in data) {
    return data.result;
  }
  return data;
}

function metricValue(
  measures: SonarqubeComponentMeasure['measures'] = [],
  metric: string,
): number {
  const measure = measures.find(
    (item) => item.key === metric || item.metric === metric || item.name === metric,
  );
  const numeric = Number(measure?.value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function isFileComponent(component: SonarqubeComponentMeasure): boolean {
  const componentType = component.type || component.qualifier;

  return !componentType || componentType === 'FIL';
}

function toCrapMetricData(component: SonarqubeComponentMeasure): CrapMetricData {
  const complexity = metricValue(component.measures, 'complexity');
  const coverage = metricValue(component.measures, 'coverage');

  return {
    componentKey: component.key,
    name: component.name || component.key,
    complexity,
    coverage,
    crap: calculateCrapScore(complexity, coverage),
  };
}

export default async function SourceCodePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams ?? {};
  const filters = parseDashboardFilters(resolvedSearchParams, defaultFilters);
  const bigOSearchParam = resolvedSearchParams.big_o_search;
  const bigOSearch = Array.isArray(bigOSearchParam) ? bigOSearchParam[0] ?? '' : bigOSearchParam ?? '';
  let entityChurn: EntityChurnData[] = [];
  let coupling: CouplingData[] = [];
  let layeredCoupling: LayeredCouplingData[] = [];
  let entityEffort: EntityEffortData[] = [];
  let codeChurn: CodeChurnData[] = [];
  let entityOwnership: EntityOwnershipData[] = [];
  let crapMetrics: CrapMetricData[] = [];
  let bigOFiles: BigOFileSummaryResponse[] = [];
  let topPairings: Array<{ author: string; co_author: string; paired_commits: number }> = [];
  let latestPairedCommits: Array<{
    hash: string;
    author: string;
    co_authors: string[];
    timestamp: string;
    subject: string;
  }> = [];

  try {
    const apiParams = buildSourceCodeApiParams(filters);
    const sonarqubeParams = {
      ...buildSonarqubeApiParams(filters),
      metrics: 'complexity,coverage',
      remove_folders: 'true',
    };
    const [churn, couplingData, layeredCouplingData, effort, churnOverTime, ownership, pairing, bigO, sonarqubeTree] = await Promise.all([
      sourceCodeAPI.entityChurn(apiParams),
      sourceCodeAPI.coupling(apiParams),
      sourceCodeAPI.layeredCoupling(apiParams),
      sourceCodeAPI.entityEffort(apiParams),
      sourceCodeAPI.codeChurn(apiParams),
      sourceCodeAPI.entityOwnership(apiParams),
      sourceCodeAPI.pairingIndex(apiParams),
      sourceCodeAPI.bigOFiles({ ...apiParams, search: bigOSearch, limit: 200 }),
      sonarqubeAPI.componentTree(sonarqubeParams),
    ]);
    // Handle both direct array responses and wrapped responses
    entityChurn = ensureArray<EntityChurnData>(unwrapResult(churn as EntityChurnData[] | ResultWrapper<EntityChurnData[]>));
    coupling = ensureArray<CouplingData>(unwrapResult(couplingData as CouplingData[] | ResultWrapper<CouplingData[]>));
    layeredCoupling = ensureArray<LayeredCouplingData>(
      unwrapResult(layeredCouplingData as LayeredCouplingData[] | ResultWrapper<LayeredCouplingData[]>)
    );
    entityEffort = ensureArray<EntityEffortData>(unwrapResult(effort as EntityEffortData[] | ResultWrapper<EntityEffortData[]>));
    codeChurn = ensureArray<CodeChurnData>(unwrapResult(churnOverTime as CodeChurnData[] | ResultWrapper<CodeChurnData[]>));
    entityOwnership = ensureArray<EntityOwnershipData>(unwrapResult(ownership as EntityOwnershipData[] | ResultWrapper<EntityOwnershipData[]>));
    bigOFiles = ensureArray<BigOFileSummaryResponse>(unwrapResult(bigO as BigOFileSummaryResponse[] | ResultWrapper<BigOFileSummaryResponse[]>));
    crapMetrics = ensureArray<SonarqubeComponentMeasure>(
      unwrapResult(sonarqubeTree as SonarqubeComponentMeasure[] | ResultWrapper<SonarqubeComponentMeasure[]>)
    )
      .filter(isFileComponent)
      .map(toCrapMetricData)
      .filter((item) => item.complexity > 0);
    const pairingData = unwrapResult(pairing as PairingIndexResponse | ResultWrapper<PairingIndexResponse>);
    topPairings = Array.isArray(pairingData?.top_pairs) ? pairingData.top_pairs.slice(0, 10) : [];
    latestPairedCommits = Array.isArray(pairingData?.latest_paired_commits)
      ? pairingData.latest_paired_commits.slice(0, 20)
      : [];
  } catch (error) {
    console.error('Error fetching source code data:', error);
    // Set empty arrays on error
    entityChurn = [];
    coupling = [];
    layeredCoupling = [];
    entityEffort = [];
    codeChurn = [];
    entityOwnership = [];
    crapMetrics = [];
    bigOFiles = [];
    topPairings = [];
    latestPairedCommits = [];
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <BigOAnalysisCard files={bigOFiles} search={bigOSearch} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <CrapMetricCard data={crapMetrics} topEntries={filters.topEntries} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <CodeChurnOverTimeCard data={codeChurn} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopPairingsCard data={topPairings} />

        <LatestPairedCommitsCard data={latestPairedCommits} />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <EntityChurnCard data={entityChurn} topEntries={filters.topEntries} />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <EntityEffortCard data={entityEffort} topEntries={filters.topEntries} />
        <EntityEffortTreemap data={entityEffort} />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <EntityOwnershipCard data={entityOwnership} />
      </div>

      <CodeCouplingCard data={coupling} />
      <LayeredCouplingClusterCard data={layeredCoupling} />
    </div>
  );
}
