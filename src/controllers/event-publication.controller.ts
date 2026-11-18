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
  BetEventSchema,
  type BetEvent,
  PublishResponseSchema,
  type PublishResponse,
} from '../contracts';

import { PublisherService } from '../services';
import { ZodBodyPipe } from '../pipes';
import { openApiSchema } from '../utils';

const exampleEvent: BetEvent = {
  betId: 'bet-1',
  playerId: 'player-1',
  currency: 'USD',
  stake: '5',
  winAmount: '15.25',
  settledAt: '2026-11-18T12:00:00Z',
};

@ApiTags('Test events')
@ApiBadRequestResponse({ description: 'Invalid event or request body' })
@ApiServiceUnavailableResponse({
  description:
    'Broker unavailable, overloaded, or publisher confirmation timed out; retry the same betId',
})
@Controller('events')
export class EventPublicationController {
  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  @Post('bet.settled')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_settled',
    summary: 'Publish a settled bet',
    description:
      '202 confirms durable RabbitMQ acceptance. Leaderboard processing is asynchronous.',
  })
  @ApiBody({
    schema: openApiSchema(BetEventSchema),
    examples: { example: { value: exampleEvent } },
  })
  @ApiAcceptedResponse({ schema: openApiSchema(PublishResponseSchema) })
  async settled(
    @Body(new ZodBodyPipe(BetEventSchema)) event: BetEvent,
  ): Promise<PublishResponse> {
    await this.publisher.publish('bet.settled', event);
    return { status: 'accepted', betId: event.betId, eventType: 'bet.settled' };
  }

  @Post('bet.rollback')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_rollback',
    summary: 'Publish a bet rollback',
    description:
      'Rollback is terminal, idempotent and may precede settlement. Supply the original playerId.',
  })
  @ApiBody({
    schema: openApiSchema(BetEventSchema),
    examples: { example: { value: exampleEvent } },
  })
  @ApiAcceptedResponse({ schema: openApiSchema(PublishResponseSchema) })
  async rollback(
    @Body(new ZodBodyPipe(BetEventSchema)) event: BetEvent,
  ): Promise<PublishResponse> {
    await this.publisher.publish('bet.rollback', event);
    return {
      status: 'accepted',
      betId: event.betId,
      eventType: 'bet.rollback',
    };
  }
}
