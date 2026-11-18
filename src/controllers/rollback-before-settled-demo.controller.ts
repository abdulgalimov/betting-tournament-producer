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
  RollbackBeforeSettledDemoResponseSchema,
  type RollbackBeforeSettledDemoResponse,
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
@Controller('demo/rollback-before-settled')
export class RollbackBeforeSettledDemoController {
  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_rollbackBeforeSettledDemo',
    summary: 'Demonstrate terminal cancellation published before settlement',
    description:
      'Publishes a rollback before settlement of the same 100 USD bet, followed by a separate 10 USD control bet for the same player. The cancellation tombstone is terminal, so the cancelled bet contributes 0 and only the control bet contributes: expectedPoints is 10, never 110. After asynchronous processing, query tournament GET /leaderboard at http://localhost:3000/docs with X-Player-Id set to response.playerId. Each run creates fresh IDs. Response events include kinds and publication order; RabbitMQ bodies remain the six-field event payloads. A 202 confirms publisher acceptance, not consumer commit order or completed leaderboard processing. A partial failure may already have published preceding events.',
  })
  @ApiBody({
    schema: openApiSchema(DemoRequestSchema),
    examples: { example: { value: {} } },
  })
  @ApiAcceptedResponse({
    schema: openApiSchema(RollbackBeforeSettledDemoResponseSchema),
  })
  async rollbackBeforeSettledDemo(
    @Body(new ZodBodyPipe(DemoRequestSchema)) _body: Record<string, never>,
  ): Promise<RollbackBeforeSettledDemoResponse> {
    const runId = randomUUID();
    const prefix = `rollback-first-${runId}`;
    const playerId = `${prefix}:player`;
    const now = Date.now();
    const cancelled: BetEvent = {
      betId: `${prefix}:bet-cancelled`,
      playerId,
      currency: 'USD',
      stake: '5',
      winAmount: '100',
      settledAt: new Date(now - 1000).toISOString(),
    };
    const control: BetEvent = {
      betId: `${prefix}:bet-control`,
      playerId,
      currency: 'USD',
      stake: '5',
      winAmount: '10',
      settledAt: new Date(now).toISOString(),
    };
    await this.publisher.publish('bet.rollback', cancelled);
    await this.publisher.publish('bet.settled', cancelled);
    await this.publisher.publish('bet.settled', control);
    return {
      status: 'accepted',
      runId,
      published: 3,
      playerId,
      cancelledBetId: cancelled.betId,
      controlBetId: control.betId,
      expectedPoints: '10',
      expectedCancelledBetPoints: '0',
      events: [
        { eventType: 'bet.rollback', event: cancelled },
        { eventType: 'bet.settled', event: cancelled },
        { eventType: 'bet.settled', event: control },
      ],
    };
  }
}
