import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type BetEvent,
  DemoRequestSchema,
  DuplicateSettledDemoResponseSchema,
  type DuplicateSettledDemoResponse,
} from '../contracts';

import { PublisherService } from '../services';
import { ZodBodyPipe } from '../pipes';
import { openApiSchema } from '../utils';

@ApiTags('Test events')
@ApiBadRequestResponse({ description: 'Invalid event or request body' })
@ApiServiceUnavailableResponse({
  description:
    'Broker unavailable, overloaded, or publisher confirmation timed out; retry the same betId',
})
@Controller('demo/duplicate-settled')
export class DuplicateSettledDemoController {
  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_duplicateSettledDemo',
    summary: 'Demonstrate idempotent handling of three identical settlements',
    description:
      'Publishes three identical copies of one 10 USD bet.settled event with the same betId and every field unchanged, including settledAt. Only one 10-point credit is expected, rather than three credits. After asynchronous processing, query tournament GET /leaderboard at http://localhost:3000/docs using response.playerId as X-Player-Id. Copy response.event into POST /events/bet.settled to replay the same event again; the balance must remain 10. Every demo run creates fresh IDs. RabbitMQ receives the plain six-field event body. A 202 confirms publisher acceptance, not completed leaderboard processing. A partial failure may already have published preceding copies.',
  })
  @ApiBody({
    schema: openApiSchema(DemoRequestSchema),
    examples: { example: { value: {} } },
  })
  @ApiAcceptedResponse({
    schema: openApiSchema(DuplicateSettledDemoResponseSchema),
  })
  async duplicateSettledDemo(
    @Body(new ZodBodyPipe(DemoRequestSchema)) _body: Record<string, never>,
  ): Promise<DuplicateSettledDemoResponse> {
    const runId = randomUUID();
    const prefix = `duplicate-settled-${runId}`;
    const playerId = `${prefix}:player`;
    const event: BetEvent = {
      betId: `${prefix}:bet`,
      playerId,
      currency: 'USD',
      stake: '5',
      winAmount: '10',
      settledAt: new Date().toISOString(),
    };
    for (let copy = 0; copy < 3; copy++) {
      await this.publisher.publish('bet.settled', event);
    }
    return {
      status: 'accepted',
      runId,
      published: 3,
      playerId,
      betId: event.betId,
      expectedPoints: '10',
      event,
    };
  }
}
