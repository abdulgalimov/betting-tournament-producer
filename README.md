# Tournament test producer

NestJS-приложение для публикации тестовых событий в RabbitMQ и проверки HTTP API турнира. В каталоге находятся один `package.json`, собственный lockfile, `src/` и `test/`.

Закреплённые версии: Node.js 26.13.1 LTS, pnpm 12.21.0; протокол RabbitMQ проверен на 4.4.1.

## Локальный запуск

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

RabbitMQ должен быть доступен по `RABBITMQ_URL`. Producer создаёт согласованную топологию `bets` / `tournament.bets`, DLX `bets.dlx` и DLQ `tournament.bets.dlq`. Producer способен запускаться раньше потребителя. Готовность: `GET http://localhost:3001/health/ready`, Swagger: `http://localhost:3001/docs`, OpenAPI producer: `http://localhost:3001/openapi.json`.

`pnpm build` собирает приложение через Rspack (`@rspack/core` и `@rspack/cli`) в ESM-файл `dist/main.js`, `pnpm start` запускает собранный код. Зависимости остаются внешними и загружаются из `node_modules`. `pnpm dev` пересобирает приложение при изменениях через Rspack и перезапускает Node.js. Обе команды сборки используют файлы только этого проекта. `pnpm check` проверяет сборку, типы приложения, тестов и скриптов, соответствие клиента сохранённому OpenAPI, линтер, форматирование.

Генератор OpenAPI-клиента и CLI leaderboard запускаются отдельно через `tsx`, без включения в бандл приложения.

## Клиент HTTP API турнира

Контракт HTTP API получают только из OpenAPI. Для обновления клиента запустите tournament, затем в каталоге producer:

```sh
pnpm client:generate http://localhost:3000/openapi.json
pnpm check
```

URL можно задать через `TOURNAMENT_OPENAPI_URL` в `.env`; значение по умолчанию — `http://localhost:3000/openapi.json`. Скрипт принимает HTTP(S) URL без встроенных учётных данных, ограничивает время запроса десятью секундами и отклоняет перенаправления и внешние `$ref`. OpenAPI должен быть одним JSON-документом версии 3.0 или 3.1 с локальными ссылками.

Генерация сохраняет `openapi/tournament.json` и `src/tournament-client/generated/schema.ts`. Оба файла входят в репозиторий, поэтому для обычной сборки работающий API и сеть не нужны. При ошибке скачивания или проверки существующий клиент сохраняется. `pnpm client:check` проверяет соответствие сгенерированного файла сохранённому JSON без обращения к API; обновление удалённого контракта выполняется явно через `client:generate`.

Используются [openapi-typescript](https://openapi-ts.dev/node) и [openapi-fetch](https://openapi-ts.dev/openapi-fetch/): параметры и ответы HTTP выводятся из сгенерированной схемы, без импортов или вручную перенесённых HTTP DTO из tournament.

```ts
import { createTournamentClient } from './src/tournament-client';

const client = createTournamentClient('http://localhost:3000');
const { data, error, response } = await client.GET('/leaderboard', {
  params: { header: { 'X-Player-Id': 'demo-player' } },
  signal: AbortSignal.timeout(5000),
});
```

Готовый CLI-пример:

```sh
TOURNAMENT_URL=http://localhost:3000 pnpm leaderboard demo-player
```

`X-Player-Id` — тестовый идентификатор игрока. Клиент даёт проверку типов при компиляции; полученный JSON не проходит автоматическую runtime-валидацию.

События AMQP — отдельный контракт producer, описанный Zod в `src/contracts/bet-event.ts`. HTTP OpenAPI турнира не описывает RabbitMQ. Поэтому схемы сообщений принадлежат producer и не генерируются из HTTP API.

## Публикация событий и демо

```sh
curl -X POST http://localhost:3001/events/bet.settled \
  -H 'Content-Type: application/json' \
  -d '{"betId":"bet-1","playerId":"demo-player","currency":"USD","stake":"5","winAmount":"10","settledAt":"2026-11-18T12:00:00.000001Z"}'
```

Для отмены используйте `/events/bet.rollback` с теми же шестью полями. Денежные значения — десятичные строки с точностью до 6 знаков после точки. `settledAt` — фактическое время расчёта с часовым поясом и точностью до микросекунд. Тип события передаётся routing key, в JSON его нет. Входные тела проходят строгую Zod-валидацию. Ответ `202` означает publisher confirmation от RabbitMQ; обработка и обновление лидерборда происходят асинхронно. При неизвестном результате публикации повторяйте запрос с тем же `betId`.

Все сценарии принимают `{}`:

| Endpoint                             | Проверка                                |
| ------------------------------------ | --------------------------------------- |
| `POST /demo`                         | Конвертация валюты, дубликат и rollback |
| `POST /demo/tie-break`               | Равные очки, порядок по `settledAt`     |
| `POST /demo/rollback-tie-break`      | Подготовка смены порядка после rollback |
| `POST /demo/rollback-before-settled` | Окончательная отмена до settlement      |
| `POST /demo/duplicate-settled`       | Три доставки одной ставки               |

Второй этап `POST /demo/rollback-tie-break/rollback` принимает полный объект `rollbackRequest` из ответа первого этапа. Сценарии создают уникальные идентификаторы, опубликованные сообщения и ожидаемые результаты видны в ответах и Swagger. Общий сценарий `/demo` требует EUR в курсах tournament; остальные используют USD.

## Docker

```sh
cp .env.example .env
# RABBITMQ_DOCKER_URL задаёт адрес внешнего брокера из контейнера.
docker compose up --build -d
```

Compose запускает только producer. По умолчанию брокер доступен через `host.docker.internal:5672`; для Linux настроен `host-gateway`. Можно подключить любой внешний брокер через `RABBITMQ_DOCKER_URL`. Образ собирается с контекстом текущего каталога и не читает соседний проект. Не запускайте одновременно локальный producer и контейнер на порту 3001.


## Конфигурация

| Переменная               | По умолчанию                                  | Назначение                                    |
| ------------------------ | --------------------------------------------- | --------------------------------------------- |
| `PORT`                   | `3001`                                        | HTTP-порт                                     |
| `RABBITMQ_URL`           | `amqp://tournament:tournament@localhost:5672` | Брокер для локального процесса                |
| `PUBLISH_TIMEOUT_MS`     | `5000`                                        | Ожидание publisher confirmation, 100–30000 мс |
| `LOG_LEVEL`              | `info`                                        | Уровень Pino                                  |
| `RABBITMQ_DOCKER_URL`    | адрес брокера через `host.docker.internal`    | URL брокера из Docker                         |
| `TOURNAMENT_OPENAPI_URL` | `http://localhost:3000/openapi.json`          | Источник генерации клиента                    |
| `TOURNAMENT_URL`         | `http://localhost:3000`                       | API турнира для CLI и E2E                     |
| `PRODUCER_URL`           | `http://localhost:3001`                       | API producer для E2E                          |

Producer — локальная тестовая утилита без аутентификации. Не публикуйте её HTTP-порт в общедоступной сети. Пароли и строки подключения не должны попадать в логи.
