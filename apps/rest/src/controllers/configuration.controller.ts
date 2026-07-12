import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Configuration } from '@smmachine/core';
import { ConfigurationResponse } from '../dtos';

/**
 * Configuration REST Controller
 * Provides endpoints for system configuration retrieval
 */
@ApiTags('Configuration')
@Controller()
export class ConfigurationController {
  constructor(private readonly config: Configuration) {}

  @Get('/configuration')
  configuration(): ConfigurationResponse {
    return {
      result: {
        git_provider: this.config.gitProvider,
        github_repository: this.config.githubRepository,
        git_repository_location: this.config.gitRepositoryLocation,
        store_data: this.config.storeData,
        deployment_frequency_targets: this.config.getDeploymentFrequencyTargets(),
        main_branch: this.config.mainBranch,
        dashboard_start_date: this.config.dashboardStartDate || null,
        dashboard_end_date: this.config.dashboardEndDate || null,
        dashboard_color: this.config.dashboardColor,
        logging_level: this.config.loggingLevel,
        jira_url: this.config.jiraUrl || null,
        jira_email: this.config.jiraEmail || null,
        jira_token: this.config.jiraToken || null,
        jira_project: this.config.jiraProject || null,
        sonar_url: this.config.sonarUrl || null,
        sonar_project: this.config.sonarProject || null,
      },
    };
  }
}
