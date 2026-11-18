import type { Channel } from 'amqplib';

export const AMQP = {
  exchange: 'bets',
  queue: 'tournament.bets',
  deadLetterExchange: 'bets.dlx',
  deadLetterQueue: 'tournament.bets.dlq',
  deadLetterRoutingKey: 'failed',
  prefetch: 16,
  maxDeliveryAttempts: 5,
} as const;

/** Both applications declare the same topology, so publishing is safe before a consumer starts. */
export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(AMQP.exchange, 'topic', { durable: true });
  await channel.assertExchange(AMQP.deadLetterExchange, 'direct', {
    durable: true,
  });
  await channel.assertQueue(AMQP.deadLetterQueue, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
  await channel.bindQueue(
    AMQP.deadLetterQueue,
    AMQP.deadLetterExchange,
    AMQP.deadLetterRoutingKey,
  );
  await channel.assertQueue(AMQP.queue, {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',
      'x-delivery-limit': AMQP.maxDeliveryAttempts,
      'x-dead-letter-exchange': AMQP.deadLetterExchange,
      'x-dead-letter-routing-key': AMQP.deadLetterRoutingKey,
      'x-dead-letter-strategy': 'at-least-once',
      'x-overflow': 'reject-publish',
    },
  });
  await channel.bindQueue(AMQP.queue, AMQP.exchange, 'bet.settled');
  await channel.bindQueue(AMQP.queue, AMQP.exchange, 'bet.rollback');
}
