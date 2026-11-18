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
  DemoResponseSchema,
  type DemoResponse,
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
@Controller('demo')
export class DemoController {
  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    operationId: 'EventsController_demo',
    summary: 'Publish a small reproducible scenario',
    description:
      'A new run creates Alice (EUR 10), Carol (USD 15), and Bob (USD 20, duplicate, rollback). Requires EUR in the tournament exchange-rate configuration. A partial failure can already have published preceding events.',
  })
  @ApiBody({ schema: openApiSchema(DemoRequestSchema) })
  @ApiAcceptedResponse({ schema: openApiSchema(DemoResponseSchema) })
  async demo(
    @Body(new ZodBodyPipe(DemoRequestSchema)) _body: Record<string, never>,
  ): Promise<DemoResponse> {
    const runId = randomUUID();
    const prefix = `demo-${runId}`;
    const playerIds = ['alice', 'bob', 'carol'].map(
      (name) => `${prefix}:${name}`,
    );
    const [alice, bob, carol] = playerIds as [string, string, string];
    const settledAt = new Date().toISOString();
    const event = (
      name: string,
      playerId: string,
      currency: string,
      winAmount: string,
    ): BetEvent => ({
      betId: `${prefix}:${name}`,
      playerId,
      currency,
      stake: '5',
      winAmount,
      settledAt,
    });
    const bobEvent = event('bet-bob', bob, 'USD', '20');
    await this.publisher.publish(
      'bet.settled',
      event('bet-alice', alice, 'EUR', '10'),
    );
    await this.publisher.publish('bet.settled', bobEvent);
    await this.publisher.publish('bet.settled', bobEvent);
    await this.publisher.publish('bet.rollback', bobEvent);
    await this.publisher.publish(
      'bet.settled',
      event('bet-carol', carol, 'USD', '15'),
    );
    return { status: 'accepted', published: 5, playerIds, runId };
  }
}
