import { z } from 'zod';

const LoadTestSettingsSchema = z.strictObject({
  durationSeconds: z.number().int().min(1).max(60),
  messagesPerSecond: z.number().int().min(1).max(5000),
  concurrency: z.number().int().min(1).max(128),
  players: z.number().int().min(1).max(4096),
});

export const LoadTestRequestSchema = z.strictObject({
  durationSeconds: LoadTestSettingsSchema.shape.durationSeconds.default(20),
  messagesPerSecond:
    LoadTestSettingsSchema.shape.messagesPerSecond.default(1000),
  concurrency: LoadTestSettingsSchema.shape.concurrency.default(64),
  players: LoadTestSettingsSchema.shape.players.default(128),
});
export type LoadTestRequest = z.infer<typeof LoadTestRequestSchema>;

export const LoadTestStatusSchema = z.strictObject({
  runId: z.uuid(),
  status: z.enum(['running', 'stopping', 'completed', 'cancelled', 'failed']),
  settings: LoadTestSettingsSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  elapsedSeconds: z.number().nonnegative(),
  attempted: z.number().int().nonnegative(),
  confirmed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  confirmedPerSecond: z.number().nonnegative(),
});
export type LoadTestStatus = z.infer<typeof LoadTestStatusSchema>;
