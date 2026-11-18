import { Global, Module } from '@nestjs/common';
import { ProducerConfig } from './producer.config';

@Global()
@Module({ providers: [ProducerConfig], exports: [ProducerConfig] })
export class ProducerConfigModule {}
