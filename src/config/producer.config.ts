import { Injectable } from '@nestjs/common';
import { ProducerEnvironmentSchema } from './producer-environment.schema';

export function readProducerConfig(environment: NodeJS.ProcessEnv) {
  const result = ProducerEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    // Never print environment values, especially a RabbitMQ URL containing credentials.
    throw new Error(
      `Invalid producer configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return {
    port: result.data.PORT,
    rabbitmqUrl: result.data.RABBITMQ_URL,
    publishTimeoutMs: result.data.PUBLISH_TIMEOUT_MS,
    logLevel: result.data.LOG_LEVEL,
  };
}

@Injectable()
export class ProducerConfig {
  readonly values = readProducerConfig(process.env);
}
