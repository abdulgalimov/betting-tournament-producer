import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ProducerConfig } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  try {
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.enableShutdownHooks();
    const config = app.get(ProducerConfig);
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Tournament test producer')
        .setDescription(
          'Publish validated AMQP events. A 202 response means publisher confirmation, not leaderboard completion. This application is a local test utility without authentication.',
        )
        .setVersion('1.0.0')
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: '/openapi.json',
    });
    await app.listen(config.values.port, '0.0.0.0');
    logger.log(
      `Swagger UI: http://localhost:${config.values.port}/docs`,
      'Bootstrap',
    );
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch(() => {
  // Avoid logging arbitrary configuration or connection errors that can contain credentials.
  process.stderr.write(
    'Producer startup failed; check environment and application logs.\n',
  );
  process.exitCode = 1;
});
