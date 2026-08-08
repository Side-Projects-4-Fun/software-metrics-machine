import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getApplicationVersion } from '@smmachine/utils';
import { VersionResponse } from '../dtos';

/**
 * Version REST Controller
 * Provides the application version to API clients.
 */
@ApiTags('Version')
@Controller()
export class VersionController {
  @Get('/version')
  version(): VersionResponse {
    return {
      result: {
        version: getApplicationVersion(),
      },
    };
  }
}
