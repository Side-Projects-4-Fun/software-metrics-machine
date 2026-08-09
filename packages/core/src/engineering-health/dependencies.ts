import type { ArchitectureService } from '../domain/architecture';
import type { CodemaatService, IPairingIndexService, SonarQubeService } from '../domain/code';
import type {
  DeploymentFrequencyTarget,
  IPipelinesService,
  PipelineImplementation,
} from '../domain/pipelines';
import type { DeploymentFrequencyService } from '../domain/pipelines/services/deployment-frequency-service';
import type { IChangeRequestsService } from '../domain/change-requests';

export interface EngineeringHealthDependencies {
  deploymentTargets: DeploymentFrequencyTarget[];
  pipelinesService: IPipelinesService;
  deploymentFrequencyService: DeploymentFrequencyService;
  pipelineImplementation: PipelineImplementation;
  changeRequestsService: IChangeRequestsService;
  pairingService: IPairingIndexService;
  codemaatService: CodemaatService;
  sonarQubeService: SonarQubeService;
  architectureService: ArchitectureService;
}
