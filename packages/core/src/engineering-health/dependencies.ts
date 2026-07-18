import type { ArchitectureService } from '../domain/architecture';
import type { CodemaatService, IPairingIndexService, SonarQubeService } from '../domain/code';
import type {
  DeploymentFrequencyTarget,
  IPipelinesService,
  PipelineImplementation,
} from '../domain/pipelines';
import type { DeploymentFrequencyService } from '../domain/pipelines/services/deployment-frequency-service';
import type { IPRsService } from '../domain/prs';

export interface EngineeringHealthDependencies {
  deploymentTargets: DeploymentFrequencyTarget[];
  pipelinesService: IPipelinesService;
  deploymentFrequencyService: DeploymentFrequencyService;
  pipelineImplementation: PipelineImplementation;
  prsService: IPRsService;
  pairingService: IPairingIndexService;
  codemaatService: CodemaatService;
  sonarQubeService: SonarQubeService;
  architectureService: ArchitectureService;
}
