import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  /** Liveness only confirms that the HTTP process is responding. */
  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'omran-mall-api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness confirms that the service can reach its required database. */
  @Get('ready')
  async ready() {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException('Database is not ready');
    }

    return {
      status: 'ready',
      service: 'omran-mall-api',
      dependencies: { database: 'ready' },
      timestamp: new Date().toISOString(),
    };
  }
}
