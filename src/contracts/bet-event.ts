import { z } from 'zod';

export const PlayerIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
  .describe(
    '1–128 ASCII characters: letters, digits, dot, underscore, colon or hyphen',
  );

export const MoneySchema = z
  .string()
  .max(25)
  .regex(/^(0|[1-9]\d{0,17})(\.\d{1,6})?$/)
  .describe(
    'Nonnegative decimal string, at most 18 integer digits and 6 decimal places',
  );

export const PointsSchema = z.string().regex(/^(0|[1-9]\d*)(\.\d{1,12})?$/);

export const EventKindSchema = z.enum(['bet.settled', 'bet.rollback']);
export type EventKind = z.infer<typeof EventKindSchema>;

/** Producer-owned AMQP contract. The routing key carries the event kind; the JSON body has exactly these six fields. */
export const BetEventSchema = z.strictObject({
  betId: PlayerIdSchema,
  playerId: PlayerIdSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  stake: MoneySchema,
  winAmount: MoneySchema,
  settledAt: z.iso
    .datetime({ offset: true })
    .regex(/^[^.]+(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/)
    .describe(
      'Actual bet settlement time with timezone and up to 6 fractional second digits; not publication or delivery time',
    ),
});
export type BetEvent = z.infer<typeof BetEventSchema>;
