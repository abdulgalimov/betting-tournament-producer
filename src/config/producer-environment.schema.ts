import { z } from 'zod';

export const ProducerEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  RABBITMQ_URL: z
    .url()
    .refine((value) => /^amqps?:\/\//.test(value), 'Use amqp:// or amqps://')
    .default(
      'amqp://tournament_producer:tournament_producer@localhost:5672/tournament',
    ),
  PUBLISH_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});
