import { randomUUID } from 'node:crypto';
import { setMaxListeners } from 'node:events';
import { setImmediate, setTimeout } from 'node:timers/promises';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { LoadTestRequest, LoadTestStatus } from '../contracts/load-test';
import { PublisherService } from './publisher.service';

type LoadTestRun = {
  progress: Omit<LoadTestStatus, 'elapsedSeconds' | 'confirmedPerSecond'>;
  startedAtMs: number;
  finishedAtMs?: number;
  abort: AbortController;
};

@Injectable()
export class LoadTestService implements OnModuleDestroy {
  private currentRun?: LoadTestRun;
  private activeTask?: Promise<void>;
  private closing = false;

  constructor(
    @Inject(PublisherService) private readonly publisher: PublisherService,
  ) {}

  start(settings: LoadTestRequest): LoadTestStatus {
    const status = this.currentRun?.progress.status;
    if (status === 'running' || status === 'stopping') {
      throw new ConflictException('A load test is already active');
    }
    if (this.closing || !this.publisher.isReady()) {
      throw new ServiceUnavailableException('RabbitMQ publisher unavailable');
    }

    const run: LoadTestRun = {
      progress: {
        runId: randomUUID(),
        status: 'running',
        settings: { ...settings },
        startedAt: new Date().toISOString(),
        finishedAt: null,
        attempted: 0,
        confirmed: 0,
        failed: 0,
      },
      startedAtMs: performance.now(),
      abort: new AbortController(),
    };
    setMaxListeners(settings.concurrency, run.abort.signal);
    this.currentRun = run;
    this.activeTask = this.execute(run);
    return this.snapshot(run);
  }

  get(runId: string): LoadTestStatus {
    return this.snapshot(this.findRun(runId));
  }

  stop(runId: string): LoadTestStatus {
    const run = this.findRun(runId);
    this.cancel(run);
    return this.snapshot(run);
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    if (this.currentRun) this.cancel(this.currentRun);
    await this.activeTask;
  }

  private findRun(runId: string): LoadTestRun {
    if (this.currentRun?.progress.runId !== runId) {
      throw new NotFoundException('Load test run not found');
    }
    return this.currentRun;
  }

  private cancel(run: LoadTestRun): void {
    if (run.progress.status === 'running') {
      run.progress.status = 'stopping';
      run.abort.abort();
    }
  }

  private snapshot(run: LoadTestRun): LoadTestStatus {
    const elapsedSeconds =
      ((run.finishedAtMs ?? performance.now()) - run.startedAtMs) / 1000;
    return {
      ...run.progress,
      settings: { ...run.progress.settings },
      elapsedSeconds,
      confirmedPerSecond:
        elapsedSeconds > 0 ? run.progress.confirmed / elapsedSeconds : 0,
    };
  }

  private async execute(run: LoadTestRun): Promise<void> {
    await setImmediate();

    const { progress } = run;
    const { durationSeconds, messagesPerSecond, concurrency, players } =
      progress.settings;
    const deadline = run.startedAtMs + durationSeconds * 1000;
    const interval = 1000 / messagesPerSecond;
    const signal = run.abort.signal;
    const prefix = `load:${progress.runId}`;
    let nextPublishAt = run.startedAtMs;

    const worker = async (): Promise<void> => {
      try {
        while (!signal.aborted) {
          const now = performance.now();
          // Discard unused slots when confirms or the event loop delay a worker.
          const publishAt = Math.max(now, nextPublishAt);
          if (publishAt >= deadline) return;
          nextPublishAt = publishAt + interval;
          if (publishAt > now) {
            await setTimeout(Math.ceil(publishAt - now), undefined, { signal });
          }
          if (signal.aborted || performance.now() >= deadline) return;

          const sequence = progress.attempted++;
          try {
            await this.publisher.publish(
              'bet.settled',
              {
                betId: `${prefix}:bet:${sequence}`,
                playerId: `${prefix}:player:${sequence % players}`,
                currency: 'USD',
                stake: '5',
                winAmount: '15.25',
                settledAt: new Date().toISOString(),
              },
              { logSuccess: false },
            );
          } catch {
            progress.failed++;
            this.cancel(run);
            return;
          }
          progress.confirmed++;
        }
      } catch (error) {
        if (!signal.aborted) {
          this.cancel(run);
          throw error;
        }
      }
    };

    const workers = await Promise.allSettled(
      Array.from({ length: concurrency }, worker),
    );
    const remainingMs = Math.ceil(deadline - performance.now());
    if (!signal.aborted && remainingMs > 0) {
      // Keep the measurement window open even if the last slot was used early.
      await setTimeout(remainingMs, undefined, { signal }).catch(
        () => undefined,
      );
    }
    run.finishedAtMs = performance.now();
    progress.finishedAt = new Date().toISOString();
    if (
      progress.failed > 0 ||
      workers.some(({ status }) => status === 'rejected')
    ) {
      progress.status = 'failed';
    } else {
      progress.status = signal.aborted ? 'cancelled' : 'completed';
    }
  }
}
