import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigurationRepository } from '@smmachine/core';

@ApiTags('Projects')
@Controller()
export class ProjectsController {
  constructor(private readonly configRepo: ConfigurationRepository) {}

  @Get('/projects')
  getProjects(): { result: Array<{ github_repository: string }> } {
    const projects = this.configRepo.getAllProjects();
    return {
      result: projects.map((p) => ({
        github_repository: p.github_repository || '',
      })),
    };
  }
}
