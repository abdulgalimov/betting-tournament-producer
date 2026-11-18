/** Generated from openapi/tournament.json. Run pnpm client:generate; do not edit. */
export interface paths {
  '/leaderboard': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Top 100 and the current player position (one consistent snapshot) */
    get: operations['AppController_leaderboard'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/health/live': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Process liveness */
    get: operations['AppController_live'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/health/ready': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** PostgreSQL and RabbitMQ readiness */
    get: operations['AppController_ready'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  AppController_leaderboard: {
    parameters: {
      query?: never;
      header: {
        'X-Player-Id': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            top: {
              /** @description 1–128 ASCII characters: letters, digits, dot, underscore, colon or hyphen */
              playerId: string;
              points: string;
              position: number;
            }[];
            player: {
              /** @description 1–128 ASCII characters: letters, digits, dot, underscore, colon or hyphen */
              playerId: string;
              points: string;
              position: number;
            } | null;
          };
        };
      };
      /** @description Missing or invalid X-Player-Id */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AppController_live: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AppController_ready: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
}
