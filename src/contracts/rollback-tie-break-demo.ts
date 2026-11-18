import { BetEventSchema, PlayerIdSchema, PointsSchema } from './bet-event';
import { z } from 'zod';

export const DemoRankingExpectationSchema = z.strictObject({
  expectedPoints: PointsSchema,
  expectedWinnerPlayerId: PlayerIdSchema,
  expectedOrder: z.array(PlayerIdSchema).length(2),
});

export const RollbackTieBreakRollbackRequestSchema = z
  .strictObject({
    runId: z.uuid(),
    events: z.array(BetEventSchema).length(2),
  })
  .superRefine(({ runId, events }, context) => {
    const prefix = `rollback-tie-${runId}`;
    const expectedPlayers = new Map([
      [`${prefix}:bet-z-extra`, `${prefix}:z-after`],
      [`${prefix}:bet-a-extra`, `${prefix}:a-before`],
    ]);
    const seen = new Set<string>();
    for (const [index, event] of events.entries()) {
      if (expectedPlayers.get(event.betId) !== event.playerId) {
        context.addIssue({
          code: 'custom',
          path: ['events', index],
          message:
            'Use the extra bets from rollbackRequest of the same demo run',
        });
      }
      if (seen.has(event.betId)) {
        context.addIssue({
          code: 'custom',
          path: ['events', index, 'betId'],
          message: 'Each extra bet must appear exactly once',
        });
      }
      seen.add(event.betId);
    }
  })
  .describe(
    'Copy the complete rollbackRequest from POST /demo/rollback-tie-break; both extra bets of that run are required',
  );
export type RollbackTieBreakRollbackRequest = z.infer<
  typeof RollbackTieBreakRollbackRequestSchema
>;

export const RollbackTieBreakDemoResponseSchema = z.strictObject({
  status: z.literal('accepted'),
  runId: z.uuid(),
  published: z.literal(4),
  events: z.array(BetEventSchema).length(4),
  beforeRollback: DemoRankingExpectationSchema,
  afterRollback: DemoRankingExpectationSchema,
  rollbackRequest: RollbackTieBreakRollbackRequestSchema,
});
export type RollbackTieBreakDemoResponse = z.infer<
  typeof RollbackTieBreakDemoResponseSchema
>;

export const RollbackTieBreakRollbackResponseSchema = z.strictObject({
  status: z.literal('accepted'),
  runId: z.uuid(),
  published: z.literal(2),
  events: z.array(BetEventSchema).length(2),
  ...DemoRankingExpectationSchema.shape,
});
export type RollbackTieBreakRollbackResponse = z.infer<
  typeof RollbackTieBreakRollbackResponseSchema
>;
