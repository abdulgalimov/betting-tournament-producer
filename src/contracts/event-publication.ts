import { EventKindSchema, PlayerIdSchema } from './bet-event';
import { z } from 'zod';

export const PublishResponseSchema = z.strictObject({
  status: z.literal('accepted'),
  betId: PlayerIdSchema,
  eventType: EventKindSchema,
});
export type PublishResponse = z.infer<typeof PublishResponseSchema>;
