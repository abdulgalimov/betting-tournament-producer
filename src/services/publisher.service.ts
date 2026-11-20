import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { AMQP, assertTopology } from '../messaging';
import type { BetEvent, EventKind } from '../contracts';
import {
  connect,
  type AmqpConnectionManager,
  type ChannelWrapper,
} from 'amqp-connection-manager';
import type { Channel, Message } from 'amqplib';
import { PinoLogger } from 'nestjs-pino';
import { ProducerConfig } from '../config';

@Injectable()
export class PublisherService implements OnModuleInit, OnModuleDestroy {
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;
  private topologyReady = false;
  private blocked = false;
  private closing = false;
  private channelRecoveryTimer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = 0;
  private readonly activePublishes = new Set<Promise<boolean>>();
  private readonly returnedMessages = new Map<string, boolean>();

  constructor(
    @Inject(ProducerConfig) private readonly config: ProducerConfig,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    logger.setContext(PublisherService.name);
  }

  onModuleInit(): void {
    this.connection = connect([this.config.values.rabbitmqUrl], {
      heartbeatIntervalInSeconds: 5,
      reconnectTimeInSeconds: 2,
      connectionOptions: { timeout: 5000 },
    });
    this.connection.on('disconnect', () => {
      this.topologyReady = false;
      this.clearChannelRecovery();
      this.logger.warn('RabbitMQ disconnected; reconnecting');
    });
    this.connection.on('connectFailed', () =>
      this.logger.warn('RabbitMQ connection failed; retrying'),
    );
    this.connection.on('blocked', () => {
      this.blocked = true;
    });
    this.connection.on('unblocked', () => {
      this.blocked = false;
    });
    this.channel = this.connection.createChannel({
      name: 'test-producer',
      confirm: true,
      json: true,
      publishTimeout: this.config.values.publishTimeoutMs,
      setup: async (channel: Channel) => {
        this.topologyReady = false;
        channel.on('return', (message: Message) => {
          const messageId: unknown = message.properties.messageId;
          if (
            typeof messageId === 'string' &&
            this.returnedMessages.has(messageId)
          ) {
            this.returnedMessages.set(messageId, true);
          }
        });
        channel.on('error', () =>
          this.logger.error('RabbitMQ publisher channel error'),
        );
        channel.on('close', () => {
          this.topologyReady = false;
          this.scheduleChannelRecovery();
        });
        await assertTopology(channel);
        this.topologyReady = true;
        this.blocked = false;
        this.logger.info('RabbitMQ publisher ready');
      },
    });
    this.channel.on('error', () => {
      this.topologyReady = false;
      this.logger.error('RabbitMQ publisher channel setup failed');
    });
  }

  isReady(): boolean {
    return (
      !this.closing &&
      !this.blocked &&
      this.topologyReady &&
      Boolean(this.connection?.isConnected()) &&
      Boolean(this.channel)
    );
  }

  private scheduleChannelRecovery(): void {
    if (this.closing || this.channelRecoveryTimer) return;
    // amqplib closes channels before emitting the connection's close event. Reconnecting
    // synchronously here would remove the manager's connection-close listener mid-teardown.
    this.channelRecoveryTimer = setTimeout(() => {
      this.channelRecoveryTimer = undefined;
      if (
        !this.closing &&
        !this.topologyReady &&
        this.connection?.isConnected()
      ) {
        this.connection.reconnect();
      }
    }, 0);
    this.channelRecoveryTimer.unref();
  }

  private clearChannelRecovery(): void {
    if (this.channelRecoveryTimer) clearTimeout(this.channelRecoveryTimer);
    this.channelRecoveryTimer = undefined;
  }

  async publish(
    eventType: EventKind,
    event: BetEvent,
    options: { logSuccess?: boolean } = {},
  ): Promise<void> {
    const channel = this.channel;
    if (!channel || !this.isReady() || this.inFlight >= 256) {
      throw new ServiceUnavailableException(
        'RabbitMQ publisher unavailable; retry with the same betId',
      );
    }
    const messageId = randomUUID();
    this.returnedMessages.set(messageId, false);
    this.inFlight += 1;
    let publication: Promise<boolean> | undefined;
    try {
      publication = channel.publish(AMQP.exchange, eventType, event, {
        persistent: true,
        mandatory: true,
        messageId,
        type: eventType,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        timestamp: Math.floor(Date.now() / 1000),
      });
      this.activePublishes.add(publication);
      await publication;
      // RabbitMQ returns an unroutable mandatory message before issuing its publisher confirm.
      if (this.returnedMessages.get(messageId))
        throw new Error('Unroutable event');
      if (options.logSuccess !== false) {
        this.logger.info(
          { betId: event.betId, eventType, messageId },
          'Event confirmed by RabbitMQ',
        );
      }
    } catch {
      this.logger.warn(
        { betId: event.betId, eventType, messageId },
        'Event publication failed or confirmation timed out',
      );
      throw new ServiceUnavailableException(
        'Publication was not confirmed; retry with the same betId',
      );
    } finally {
      this.returnedMessages.delete(messageId);
      if (publication) this.activePublishes.delete(publication);
      this.inFlight -= 1;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    this.clearChannelRecovery();
    // Every publish has a bounded confirmation timeout, so shutdown drains accepted work.
    await Promise.allSettled([...this.activePublishes]);
    await this.channel?.close();
    await this.connection?.close();
  }
}
