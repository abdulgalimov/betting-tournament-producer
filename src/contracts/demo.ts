import { PlayerIdSchema } from './bet-event';
import { z } from 'zod';

export const DemoResponseSchema = z.strictObject({
  status: z.literal('accepted'),
  published: z.number().int().nonnegative(),
  playerIds: z.array(PlayerIdSchema),
  runId: z.uuid(),
});
export type DemoResponse = z.infer<typeof DemoResponseSchema>;
