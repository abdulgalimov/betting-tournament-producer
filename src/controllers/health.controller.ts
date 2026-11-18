import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthResponseSchema } from '../contracts';
import { PublisherService } from '../services';
import { openApiSchema } from '../utils';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness' })
  @ApiOkResponse({ schema: openApiSchema(HealthResponseSchema) })
  live() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Broker publisher readiness' })
  @ApiOkResponse({ schema: openApiSchema(HealthResponseSchema) })
  @ApiServiceUnavailableResponse({
    description: 'RabbitMQ unavailable or shutting down',
  })
  ready() {
    if (!this.publisher.isReady())
      throw new ServiceUnavailableException('RabbitMQ publisher unavailable');
    return { status: 'ok' as const };
  }
}
