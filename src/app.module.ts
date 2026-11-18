import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ProducerConfigModule, ProducerConfig } from './config';

import {
  DemoController,
  DuplicateSettledDemoController,
  EventPublicationController,
  HealthController,
  RollbackBeforeSettledDemoController,
  RollbackTieBreakDemoController,
  TieBreakDemoController,
} from './controllers';

import { PublisherService } from './services';

@Module({
  imports: [
    ProducerConfigModule,
    LoggerModule.forRootAsync({
      inject: [ProducerConfig],
      useFactory: (config: ProducerConfig) => ({
        pinoHttp: {
          level: config.values.logLevel,
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers.set-cookie',
          ],
          genReqId: (req, res) => {
            const requested = req.headers['x-request-id'];
            const requestId =
              typeof requested === 'string' &&
              /^[A-Za-z0-9._:-]{1,128}$/.test(requested)
                ? requested
                : randomUUID();
            res.setHeader('X-Request-Id', requestId);
            return requestId;
          },
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
          },
        },
      }),
    }),
  ],
  controllers: [
    EventPublicationController,
    DemoController,
    TieBreakDemoController,
    RollbackTieBreakDemoController,
    RollbackBeforeSettledDemoController,
    DuplicateSettledDemoController,
    HealthController,
  ],
  providers: [PublisherService],
})
export class AppModule {}
