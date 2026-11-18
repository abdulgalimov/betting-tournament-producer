import { spawn } from 'node:child_process';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { rspack } from '@rspack/core';
import config from '../rspack.config.mjs';

const compiler = rspack({ ...config, mode: 'development' });
let server;
let closing = false;

async function stopServer() {
  const child = server;
  server = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  await new Promise((resolve) => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 10000);
    timeout.unref();
    child.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

compiler.hooks.watchRun.tapPromise('RestartProducer', stopServer);

const watcher = compiler.watch({}, (error, stats) => {
  if (closing) return;
  if (error) {
    process.stderr.write(`${error.message}\n`);
    return;
  }
  process.stdout.write(`${stats.toString({ preset: 'errors-warnings' })}\n`);
  if (stats.hasErrors()) return;

  const child = spawn(
    process.execPath,
    ['--enable-source-maps', 'dist/main.js'],
    {
      cwd: import.meta.dirname + '/..',
      stdio: 'inherit',
    },
  );
  server = child;
  child.once('close', () => {
    if (server === child) server = undefined;
  });
  child.on('error', () => {
    if (server === child) server = undefined;
    process.stderr.write('Could not start the producer process.\n');
  });
});

async function shutdown() {
  if (closing) return;
  closing = true;
  await stopServer();
  watcher.close(() => {
    compiler.close((error) => {
      if (error) process.exitCode = 1;
    });
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
