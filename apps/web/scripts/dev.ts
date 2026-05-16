import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const PNPM_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const DEV_CONTAINER_LABEL_KEY = 'travel-planner.dev';
const DEV_CONTAINER_LABEL_VALUE = 'pnpm-dev';

const DEV_DEFAULTS = {
  AUTH_SECRET: 'dev-only-not-a-real-secret',
  AUTH_GOOGLE_ID: 'dev-placeholder-client-id',
  AUTH_GOOGLE_SECRET: 'dev-placeholder-client-secret',
  AUTH_URL: 'http://localhost:3000',
  EMAIL_FROM_ADDRESS: 'hello@mail.matthewcarr.dev',
  EMAIL_FROM_NAME: 'Travel Planner',
} as const;

function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = withoutExport.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = withoutExport.slice(0, separatorIndex).trim();
    if (!key) continue;

    const rawValue = withoutExport.slice(separatorIndex + 1).trim();
    const commentIndex = rawValue.indexOf(' #');
    const valueWithoutComment = commentIndex === -1 ? rawValue : rawValue.slice(0, commentIndex);

    if (
      (valueWithoutComment.startsWith('"') && valueWithoutComment.endsWith('"')) ||
      (valueWithoutComment.startsWith("'") && valueWithoutComment.endsWith("'"))
    ) {
      const unquoted = valueWithoutComment.slice(1, -1);
      result[key] = valueWithoutComment.startsWith('"')
        ? unquoted.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
        : unquoted;
      continue;
    }

    result[key] = valueWithoutComment;
  }

  return result;
}

function loadLocalEnvLikeNext(): void {
  const mode = process.env.NODE_ENV === 'test' ? 'test' : 'development';
  const envFiles = [`.env.${mode}.local`, mode !== 'test' ? '.env.local' : null, `.env.${mode}`, '.env']
    .filter((value): value is string => value !== null)
    .map((file) => join(process.cwd(), file));

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;

    const parsed = parseEnvFile(readFileSync(envFile, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function commandSucceeds(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

function getCommandOutput(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let output = '';
    child.stdout?.on('data', (chunk: Buffer | string) => {
      output += chunk.toString();
    });

    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
        return;
      }

      resolve(null);
    });
  });
}

async function configureContainerRuntimeEnv(): Promise<void> {
  if (!process.env.DOCKER_HOST) {
    const context = await getCommandOutput('docker', ['context', 'show']);
    if (context) {
      const dockerHost = await getCommandOutput('docker', [
        'context',
        'inspect',
        context,
        '--format',
        '{{ .Endpoints.docker.Host }}',
      ]);
      if (dockerHost) {
        process.env.DOCKER_HOST = dockerHost;
      }
    }
  }

  const dockerHost = process.env.DOCKER_HOST;
  if (!dockerHost) return;

  if (
    dockerHost.startsWith('unix://') &&
    dockerHost !== 'unix:///var/run/docker.sock' &&
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE === undefined
  ) {
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock';
  }

  if (dockerHost.includes('.colima/') && process.env.TESTCONTAINERS_HOST_OVERRIDE === undefined) {
    const colimaInfo = await getCommandOutput('colima', ['ls', '-j']);
    if (colimaInfo) {
      try {
        const parsed = JSON.parse(colimaInfo) as { address?: string };
        if (parsed.address) {
          process.env.TESTCONTAINERS_HOST_OVERRIDE = parsed.address;
        }
      } catch {
        // Ignore parse errors and continue with the existing configuration.
      }
    }
  }

  if (process.env.TESTCONTAINERS_RYUK_DISABLED === undefined) {
    process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
  }
}

async function cleanupStaleDevContainers(): Promise<void> {
  const staleContainerIds = await getCommandOutput('docker', [
    'ps',
    '-aq',
    '--filter',
    `label=${DEV_CONTAINER_LABEL_KEY}=${DEV_CONTAINER_LABEL_VALUE}`,
  ]);

  if (!staleContainerIds) return;

  const ids = staleContainerIds
    .split('\n')
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) return;

  for (const id of ids) {
    await commandSucceeds('docker', ['rm', '-f', id]);
  }

  console.log(`[dev] Removed ${ids.length} stale local dev PostgreSQL container(s).`);
}

async function waitForDockerReady(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await commandSucceeds('docker', ['info'])) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return false;
}

async function ensureDockerRuntime(): Promise<void> {
  await configureContainerRuntimeEnv();

  if (await commandSucceeds('docker', ['info'])) return;

  if (process.platform === 'darwin') {
    console.log('[dev] Docker runtime is not ready — attempting to open Docker Desktop…');
    const openDocker = spawn('open', ['-a', 'Docker'], {
      stdio: 'ignore',
      detached: true,
    });
    openDocker.on('error', () => {
      // Ignore and continue to timed runtime checks below.
    });
    openDocker.unref();

    if (await waitForDockerReady(60_000)) {
      console.log('[dev] Docker runtime is ready.');
      return;
    }
  }

  throw new Error(
    'Docker runtime is unavailable. Start Docker Desktop/OrbStack/Colima, or set POSTGRES_URL in .env.local.',
  );
}

function buildDevEnv(postgresUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    POSTGRES_URL: postgresUrl,
    AUTH_SECRET: process.env.AUTH_SECRET ?? DEV_DEFAULTS.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? DEV_DEFAULTS.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? DEV_DEFAULTS.AUTH_GOOGLE_SECRET,
    AUTH_URL: process.env.AUTH_URL ?? DEV_DEFAULTS.AUTH_URL,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS ?? DEV_DEFAULTS.EMAIL_FROM_ADDRESS,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ?? DEV_DEFAULTS.EMAIL_FROM_NAME,
  };
}

function runPnpmScript(script: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(PNPM_COMMAND, [script], {
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`pnpm ${script} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function startDevServer(env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(PNPM_COMMAND, ['dev:next'], {
    env,
    stdio: 'inherit',
  });
}

async function main(): Promise<void> {
  loadLocalEnvLikeNext();

  let startedContainer: Awaited<ReturnType<PostgreSqlContainer['start']>> | null = null;
  let devServer: ChildProcess | null = null;
  let cleaningUp = false;
  let shutdownRequested = false;

  const cleanup = async () => {
    if (cleaningUp) return;
    cleaningUp = true;

    if (startedContainer) {
      console.log('[dev] Stopping PostgreSQL container…');
      await startedContainer.stop();
      console.log('[dev] PostgreSQL container stopped.');
    }
  };

  try {
    const existingPostgresUrl = process.env.POSTGRES_URL;
    let postgresUrl = existingPostgresUrl;

    if (postgresUrl) {
      console.log('[dev] Using existing POSTGRES_URL from environment.');
    } else {
      console.log('[dev] No POSTGRES_URL found — starting local PostgreSQL container…');
      await ensureDockerRuntime();
      await cleanupStaleDevContainers();

      try {
        startedContainer = await new PostgreSqlContainer('postgres:16-alpine')
          .withDatabase('travel_planner_dev')
          .withUsername('devuser')
          .withPassword('devpass')
          .withLabels({
            [DEV_CONTAINER_LABEL_KEY]: DEV_CONTAINER_LABEL_VALUE,
          })
          .start();
      } catch {
        throw new Error(
          'Could not start a local PostgreSQL container. Start Docker or set POSTGRES_URL in .env.local.',
        );
      }

      postgresUrl = startedContainer.getConnectionUri();
      console.log(`[dev] PostgreSQL ready at ${postgresUrl}`);

      const bootstrapEnv = buildDevEnv(postgresUrl);
      console.log('[dev] Running migrations…');
      await runPnpmScript('db:migrate', bootstrapEnv);
      console.log('[dev] Seeding reference data…');
      await runPnpmScript('db:seed', bootstrapEnv);
    }

    const devEnv = buildDevEnv(postgresUrl);

    const requestShutdown = (signal: NodeJS.Signals) => {
      if (shutdownRequested) return;
      shutdownRequested = true;

      if (devServer?.exitCode === null) {
        devServer.kill(signal);
      }
    };

    process.once('SIGINT', () => requestShutdown('SIGINT'));
    process.once('SIGTERM', () => requestShutdown('SIGTERM'));

    console.log('[dev] Starting Next.js dev server…');
    devServer = startDevServer(devEnv);

    const exitCode = await new Promise<number>((resolve, reject) => {
      devServer?.on('error', reject);
      devServer?.on('close', (code) => resolve(code ?? 1));
    });

    process.exitCode = shutdownRequested ? 0 : exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[dev] Startup failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

void main();
