import { BetEventSchema, EventKindSchema, PlayerIdSchema } from './bet-event';
import { z } from 'zod';

export const DemoPublishedEventSchema = z.strictObject({
  eventType: EventKindSchema.describe('AMQP routing key used for publication'),
  event: BetEventSchema.describe(
    'Raw six-field AMQP payload; this response wrapper is not sent to RabbitMQ',
  ),
});
export type DemoPublishedEvent = z.infer<typeof DemoPublishedEventSchema>;

export const RollbackBeforeSettledDemoResponseSchema = z.strictObject({
  status: z.literal('accepted'),
  runId: z.uuid(),
  published: z.literal(3),
  playerId: PlayerIdSchema,
  cancelledBetId: PlayerIdSchema,
  controlBetId: PlayerIdSchema,
  expectedPoints: z.literal('10').describe('Only the control bet contributes'),
  expectedCancelledBetPoints: z.literal('0'),
  events: z
    .array(DemoPublishedEventSchema)
    .length(3)
    .describe(
      'Publication order: rollback, cancelled settlement, control settlement',
    ),
});
export type RollbackBeforeSettledDemoResponse = z.infer<
  typeof RollbackBeforeSettledDemoResponseSchema
>;
