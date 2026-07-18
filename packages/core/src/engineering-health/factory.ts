import { Logger } from '@smmachine/utils';
import { Configuration, TimeZoneProvider } from '../infrastructure';
import { PipelineFactory } from '../domain/pipelines/factories';
import { PipelinesService } from '../domain/pipelines/services/pipelines-service';
import { DeploymentFrequencyService } from '../domain/pipelines/services/deployment-frequency-service';
import { PipelineImplementation } from '../domain/pipelines/services/pipeline-implementation';
import { PullRequestFactory } from '../domain/prs/factories';
import { PRsService } from '../domain/prs/services/prs-service';
import { PairingFactory } from '../domain/code/pairing/pairing-factory';
import { CodemaatFactory } from '../domain/code/codemaat/codemaat-factory';
import { CodemaatService } from '../domain/code/codemaat/codemaat-service';
import { SonarqubeFactory } from '../domain/code/sonarqube/sonarqube-factory';
import { SonarQubeService } from '../domain/code/sonarqube/sonarqube-service';
import { ArchitectureService } from '../domain/architecture/architecture-service';
import type { EngineeringHealthDependencies } from './dependencies';
import { EngineeringHealthOrchestrator } from './orchestrator';
import { createDefaultEngineeringHealthRegistry } from './registry';

export function createEngineeringHealthDependencies(
  configuration: Configuration,
  logger: Logger,
  timeZoneProvider: TimeZoneProvider
): EngineeringHealthDependencies {
  const pipelineArtifacts = PipelineFactory.create(configuration, logger, timeZoneProvider);

  const pipelinesService = new PipelinesService(
    pipelineArtifacts.pipelineRepository,
    configuration,
    logger,
    timeZoneProvider
  );

  const deploymentFrequencyService = new DeploymentFrequencyService(
    pipelineArtifacts.pipelineRepository,
    configuration.getDeploymentFrequencyTargets(),
    logger,
    timeZoneProvider
  );

  const pipelineImplementation = new PipelineImplementation(
    pipelineArtifacts.pipelineRepository,
    configuration.getDeploymentFrequencyTargets(),
    logger,
    timeZoneProvider
  );

  const prsRepository = PullRequestFactory.create(configuration, logger, timeZoneProvider);
  const prsService = new PRsService(prsRepository, timeZoneProvider, logger);
  const pairingService = PairingFactory.create(configuration, logger, timeZoneProvider);

  const codemaatRepository = CodemaatFactory.create(configuration, logger);
  const codemaatService = new CodemaatService(codemaatRepository);

  const sonarqubeRepository = SonarqubeFactory.create(configuration, logger);
  const sonarQubeService = new SonarQubeService(sonarqubeRepository, logger);

  const architectureService = new ArchitectureService(configuration, logger);

  return {
    pipelinesService,
    deploymentFrequencyService,
    pipelineImplementation,
    prsService,
    pairingService,
    codemaatService,
    sonarQubeService,
    architectureService,
  };
}

export function createEngineeringHealthOrchestrator(
  configuration: Configuration,
  logger: Logger,
  timeZoneProvider: TimeZoneProvider = new TimeZoneProvider('UTC')
): EngineeringHealthOrchestrator {
  const dependencies = createEngineeringHealthDependencies(configuration, logger, timeZoneProvider);
  const registry = createDefaultEngineeringHealthRegistry(dependencies);
  return new EngineeringHealthOrchestrator(registry);
}
