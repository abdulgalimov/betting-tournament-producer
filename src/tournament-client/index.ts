import createClient from 'openapi-fetch';
import { z } from 'zod';
import type { paths } from './generated/schema';

const baseUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  );
});

/** HTTP types come only from the saved OpenAPI document, never tournament source. */
export function createTournamentClient(baseUrl: string) {
  const parsed = baseUrlSchema.safeParse(baseUrl);
  if (!parsed.success)
    throw new Error(
      'Tournament URL must be HTTP(S) without embedded credentials',
    );
  return createClient<paths>({ baseUrl: parsed.data });
}

export type { paths } from './generated/schema';
export type LeaderboardResponse =
  paths['/leaderboard']['get']['responses'][200]['content']['application/json'];
