import process from 'node:process';
import { createTournamentClient } from '../src/tournament-client';
import { PlayerIdSchema } from '../src/contracts';

try {
  const playerId = PlayerIdSchema.safeParse(process.argv[2]);
  if (!playerId.success) throw new Error();
  const client = createTournamentClient(
    process.env.TOURNAMENT_URL ?? 'http://localhost:3000',
  );
  const { data, response } = await client.GET('/leaderboard', {
    params: { header: { 'X-Player-Id': playerId.data } },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || !data) throw new Error();
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
} catch {
  process.stderr.write(
    'Could not read leaderboard; use pnpm leaderboard <player-id> and check TOURNAMENT_URL\n',
  );
  process.exitCode = 1;
}
