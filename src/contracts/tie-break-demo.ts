import { BetEventSchema, PlayerIdSchema } from './bet-event';
import { z } from 'zod';

export const TieBreakDemoResponseSchema = z.strictObject({
  status: z.literal('accepted'),
  runId: z.uuid(),
  published: z.literal(2),
  expectedWinnerPlayerId: PlayerIdSchema.describe(
    'Player expected to rank ahead of the other demo player after processing',
  ),
  expectedOrder: z
    .array(PlayerIdSchema)
    .length(2)
    .describe('Relative order of these two players in the full leaderboard'),
  events: z
    .array(BetEventSchema)
    .length(2)
    .describe(
      'Published bet.settled payloads in publication order: later first',
    ),
});
export type TieBreakDemoResponse = z.infer<typeof TieBreakDemoResponseSchema>;
