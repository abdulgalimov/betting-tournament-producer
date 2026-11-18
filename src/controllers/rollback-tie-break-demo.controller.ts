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
  RollbackTieBreakDemoResponseSchema,
  RollbackTieBreakRollbackRequestSchema,
  RollbackTieBreakRollbackResponseSchema,
  type RollbackTieBreakDemoResponse,
  type RollbackTieBreakRollbackRequest,
  type RollbackTieBreakRollbackResponse,
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
@Controller('demo/rollback-tie-break')
export class RollbackTieBreakDemoController {
  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_rollbackTieBreakDemo',
    summary:
      'Set up a two-phase demo where rollback reverses an equal-score tie',
    description:
      'Phase 1 publishes four settlements: both players reach 20 USD points and a-before ranks ahead. After asynchronous processing, inspect their relative positions with X-Player-Id on tournament GET /leaderboard at http://localhost:3000/docs. Copy rollbackRequest into POST /demo/rollback-tie-break/rollback for phase 2: both return to 10 points and z-after must rank ahead. Expected orders compare only these two players; other players affect global positions. A 202 confirms publisher acceptance, not completed leaderboard processing. A partial failure may already have published preceding events.',
  })
  @ApiBody({
    schema: openApiSchema(DemoRequestSchema),
    examples: { example: { value: {} } },
  })
  @ApiAcceptedResponse({
    schema: openApiSchema(RollbackTieBreakDemoResponseSchema),
  })
  async rollbackTieBreakDemo(
    @Body(new ZodBodyPipe(DemoRequestSchema)) _body: Record<string, never>,
  ): Promise<RollbackTieBreakDemoResponse> {
    const runId = randomUUID();
    const prefix = `rollback-tie-${runId}`;
    const beforeId = `${prefix}:a-before`;
    const afterId = `${prefix}:z-after`;
    const now = Date.now();
    const event = (
      suffix: string,
      playerId: string,
      settledAt: number,
    ): BetEvent => ({
      betId: `${prefix}:bet-${suffix}`,
      playerId,
      currency: 'USD',
      stake: '5',
      winAmount: '10',
      settledAt: new Date(settledAt).toISOString(),
    });
    const zBase = event('z-base', afterId, now - 3000);
    const aBase = event('a-base', beforeId, now - 2000);
    const aExtra = event('a-extra', beforeId, now - 1000);
    const zExtra = event('z-extra', afterId, now);
    const events = [zBase, aBase, aExtra, zExtra];
    for (const settlement of events) {
      await this.publisher.publish('bet.settled', settlement);
    }
    return {
      status: 'accepted',
      runId,
      published: 4,
      events,
      beforeRollback: {
        expectedPoints: '20',
        expectedWinnerPlayerId: beforeId,
        expectedOrder: [beforeId, afterId],
      },
      afterRollback: {
        expectedPoints: '10',
        expectedWinnerPlayerId: afterId,
        expectedOrder: [afterId, beforeId],
      },
      rollbackRequest: { runId, events: [zExtra, aExtra] },
    };
  }

  @Post('rollback')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_rollbackTieBreakDemoRollback',
    summary: 'Roll back the two extra bets and reverse the demo tie-break',
    description:
      'Phase 2 accepts the copied rollbackRequest from POST /demo/rollback-tie-break and publishes its two extra bets as rollbacks. Both players change from 20 to 10 USD points; z-after now ranks ahead because its surviving base bet settled earlier. After asynchronous processing, use each expectedOrder ID as X-Player-Id on tournament GET /leaderboard at http://localhost:3000/docs. The order is relative to these two players, not global positions. Repeating the same request is safe because rollback is idempotent. A 202 confirms publication; a partial failure may already have cancelled one extra bet.',
  })
  @ApiBody({
    schema: openApiSchema(RollbackTieBreakRollbackRequestSchema),
    description:
      'Copy the complete rollbackRequest object from the setup response. Either order of the two extra bets is accepted.',
  })
  @ApiAcceptedResponse({
    schema: openApiSchema(RollbackTieBreakRollbackResponseSchema),
  })
  async rollbackTieBreakDemoRollback(
    @Body(new ZodBodyPipe(RollbackTieBreakRollbackRequestSchema))
    request: RollbackTieBreakRollbackRequest,
  ): Promise<RollbackTieBreakRollbackResponse> {
    for (const event of request.events) {
      await this.publisher.publish('bet.rollback', event);
    }
    const prefix = `rollback-tie-${request.runId}`;
    const beforeId = `${prefix}:a-before`;
    const afterId = `${prefix}:z-after`;
    return {
      status: 'accepted',
      runId: request.runId,
      published: 2,
      events: request.events,
      expectedPoints: '10',
      expectedWinnerPlayerId: afterId,
      expectedOrder: [afterId, beforeId],
    };
  }
}
