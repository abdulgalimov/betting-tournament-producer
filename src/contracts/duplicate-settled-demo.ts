import { BetEventSchema, PlayerIdSchema } from './bet-event';
import { z } from 'zod';

export const DuplicateSettledDemoResponseSchema = z.strictObject({
  status: z.literal('accepted'),
  runId: z.uuid(),
  published: z.literal(3),
  playerId: PlayerIdSchema,
  betId: PlayerIdSchema,
  expectedPoints: z
    .literal('10')
    .describe('One credit for one bet despite three identical settlements'),
  event: BetEventSchema.describe(
    'This exact bet.settled payload is published three times and may be replayed manually',
  ),
});
export type DuplicateSettledDemoResponse = z.infer<
  typeof DuplicateSettledDemoResponseSchema
>;
