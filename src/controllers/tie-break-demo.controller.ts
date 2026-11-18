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
  TieBreakDemoResponseSchema,
  type TieBreakDemoResponse,
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
@Controller('demo/tie-break')
export class TieBreakDemoController {
  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_tieBreakDemo',
    summary: 'Demonstrate the settlement-time tie-break with two equal scores',
    description:
      'Creates two players with 10 USD points each. Publishes the later settlement first; the earlier settlement must rank ahead despite its alphabetically later playerId. After asynchronous processing, use each expectedOrder ID as X-Player-Id on tournament GET /leaderboard at http://localhost:3000/docs. expectedOrder describes only these two players, not global positions 1 and 2. A 202 response confirms publication; a partial failure may already have published the first event.',
  })
  @ApiBody({
    schema: openApiSchema(DemoRequestSchema),
    examples: { example: { value: {} } },
  })
  @ApiAcceptedResponse({ schema: openApiSchema(TieBreakDemoResponseSchema) })
  async tieBreakDemo(
    @Body(new ZodBodyPipe(DemoRequestSchema)) _body: Record<string, never>,
  ): Promise<TieBreakDemoResponse> {
    const runId = randomUUID();
    const prefix = `tie-break-${runId}`;
    const laterId = `${prefix}:a-later`;
    const earlierId = `${prefix}:z-earlier`;
    const now = Date.now();
    const laterEvent: BetEvent = {
      betId: `${prefix}:bet-a-later`,
      playerId: laterId,
      currency: 'USD',
      stake: '5',
      winAmount: '10',
      settledAt: new Date(now).toISOString(),
    };
    const earlierEvent: BetEvent = {
      betId: `${prefix}:bet-z-earlier`,
      playerId: earlierId,
      currency: 'USD',
      stake: '5',
      winAmount: '10',
      settledAt: new Date(now - 1000).toISOString(),
    };
    await this.publisher.publish('bet.settled', laterEvent);
    await this.publisher.publish('bet.settled', earlierEvent);
    return {
      status: 'accepted',
      runId,
      published: 2,
      expectedWinnerPlayerId: earlierId,
      expectedOrder: [earlierId, laterId],
      events: [laterEvent, earlierEvent],
    };
  }
}
