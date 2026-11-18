import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import openapiTS, { astToString } from 'openapi-typescript';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';

const root = new URL('../', import.meta.url);
const defaultSnapshot = new URL('openapi/tournament.json', root);
const defaultOutput = new URL(
  'src/tournament-client/generated/schema.ts',
  root,
);
const documentSchema = z.looseObject({
  openapi: z.string().regex(/^3\.[01]\.\d+$/),
  info: z.looseObject({ title: z.string(), version: z.string() }),
  paths: z.record(z.string(), z.unknown()),
});

function validateDocument(value: unknown) {
  const document = documentSchema.safeParse(value);
  if (!document.success) throw new Error('Invalid OpenAPI 3.0/3.1 document');
  // Keep generation reproducible and bounded by the single fetched document.
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (
        key === '$ref' &&
        (typeof child !== 'string' || !child.startsWith('#/'))
      ) {
        throw new Error('OpenAPI document must use local references only');
      }
      visit(child);
    }
  };
  visit(document.data);
  return document.data;
}

function parseSchemaUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
    return url;
  } catch {
    throw new Error('OpenAPI URL must be HTTP(S) without embedded credentials');
  }
}

async function render(document: ReturnType<typeof validateDocument>) {
  const config = await resolveConfig(
    new URL('../.prettierrc.json', import.meta.url),
  );
  const ast = await openapiTS(JSON.stringify(document), { silent: true });
  return format(
    '/** Generated from openapi/tournament.json. Run pnpm client:generate; do not edit. */\n' +
      astToString(ast),
    { ...config, parser: 'typescript' },
  );
}

async function atomicWrite(path: URL, contents: string): Promise<void> {
  await mkdir(dirname(fileURLToPath(path)), { recursive: true });
  const temporary = new URL(`${path.href}.${process.pid}.tmp`);
  try {
    await writeFile(temporary, contents);
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function generateTournamentClient(options: {
  schemaUrl: string;
  snapshot?: URL;
  output?: URL;
}): Promise<void> {
  const url = parseSchemaUrl(options.schemaUrl);
  let response: Response;
  let value: unknown;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error();
    const body = await response.text();
    if (body.length > 5_000_000) throw new Error();
    value = JSON.parse(body);
  } catch {
    throw new Error(
      'Could not fetch OpenAPI JSON; check the URL and API availability',
    );
  }
  const document = validateDocument(value);
  const contents = await render(document);
  const snapshot = await format(JSON.stringify(document), {
    parser: 'json',
    tabWidth: 2,
  });
  // Validate and render fully before replacing an existing working client.
  await atomicWrite(options.snapshot ?? defaultSnapshot, snapshot);
  await atomicWrite(options.output ?? defaultOutput, contents);
}

export async function checkTournamentClient(
  options: {
    snapshot?: URL;
    output?: URL;
  } = {},
): Promise<void> {
  const snapshot = JSON.parse(
    await readFile(options.snapshot ?? defaultSnapshot, 'utf8'),
  );
  const expected = await render(validateDocument(snapshot));
  const actual = await readFile(options.output ?? defaultOutput, 'utf8');
  if (actual !== expected)
    throw new Error(
      'Generated client differs from the committed OpenAPI snapshot; run pnpm client:generate',
    );
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--check' && args.length === 1) {
      await checkTournamentClient();
      process.stdout.write('Tournament client matches the OpenAPI snapshot\n');
    } else if (args.length <= 1 && !args[0]?.startsWith('-')) {
      await generateTournamentClient({
        schemaUrl:
          args[0] ??
          process.env.TOURNAMENT_OPENAPI_URL ??
          'http://localhost:3000/openapi.json',
      });
      process.stdout.write('Updated OpenAPI snapshot and tournament client\n');
    } else {
      throw new Error(
        'Usage: pnpm client:generate [http(s)://host/openapi.json]',
      );
    }
  } catch (error) {
    // Dependency errors may contain source URLs or input; expose our bounded messages only.
    const safeMessages = [
      'Invalid OpenAPI 3.0/3.1 document',
      'OpenAPI document must use local references only',
      'OpenAPI URL must be HTTP(S) without embedded credentials',
      'Could not fetch OpenAPI JSON; check the URL and API availability',
      'Generated client differs from the committed OpenAPI snapshot; run pnpm client:generate',
      'Usage: pnpm client:generate [http(s)://host/openapi.json]',
    ];
    process.stderr.write(
      `${error instanceof Error && safeMessages.includes(error.message) ? error.message : 'Tournament client generation failed; check the OpenAPI document'}\n`,
    );
    process.exitCode = 1;
  }
}
