import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getApplicationVersion } from '@smmachine/utils';
import { VersionResponse } from '../dtos';

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
