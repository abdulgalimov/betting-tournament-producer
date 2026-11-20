import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  type SchemaObject,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  LoadTestRequestSchema,
  LoadTestStatusSchema,
  type LoadTestRequest,
  type LoadTestStatus,
} from '../contracts/load-test';
import { ZodBodyPipe } from '../pipes';
import { LoadTestService } from '../services/load-test.service';
import { openApiSchema } from '../utils';

const statusSchema = openApiSchema(LoadTestStatusSchema);

@ApiTags('Load test')
@Controller('load-test')
export class LoadTestController {
  constructor(
    @Inject(LoadTestService) private readonly loadTest: LoadTestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start publishing synthetic bet settlements in the background',
    description:
      'Use a local test dataset. HTTP 202 acknowledges the run. Poll its status to see broker confirmations and failures. RabbitMQ publication and tournament processing are asynchronous.',
  })
  @ApiBody({
    schema: z.toJSONSchema(LoadTestRequestSchema, {
      target: 'openapi-3.0',
      io: 'input',
    }) as SchemaObject,
  })
  @ApiAcceptedResponse({ schema: statusSchema })
  @ApiBadRequestResponse({ description: 'Invalid load test settings' })
  @ApiConflictResponse({ description: 'A load test is already active' })
  @ApiServiceUnavailableResponse({
    description: 'RabbitMQ publisher unavailable',
  })
  start(
    @Body(new ZodBodyPipe(LoadTestRequestSchema)) settings: LoadTestRequest,
  ): LoadTestStatus {
    return this.loadTest.start(settings);
  }

  @Get(':runId')
  @ApiOperation({
    summary: 'Read progress and confirmed publications per second',
    description: 'The producer keeps the latest run in memory.',
  })
  @ApiOkResponse({ schema: statusSchema })
  @ApiNotFoundResponse({ description: 'Load test run not found' })
  get(@Param('runId') runId: string): LoadTestStatus {
    return this.loadTest.get(runId);
  }

  @Delete(':runId')
  @ApiOperation({
    summary: 'Stop a load test',
    description:
      'The producer stops issuing events and waits for pending confirmations.',
  })
  @ApiOkResponse({ schema: statusSchema })
  @ApiNotFoundResponse({ description: 'Load test run not found' })
  stop(@Param('runId') runId: string): LoadTestStatus {
    return this.loadTest.stop(runId);
  }
}
