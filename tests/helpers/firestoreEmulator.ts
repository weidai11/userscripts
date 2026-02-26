import { spawn, type ChildProcess } from 'child_process';

const DEFAULT_EMULATOR_HOST = '127.0.0.1:8080';
const STARTUP_TIMEOUT_MS = 45_000;
const PING_INTERVAL_MS = 350;

let emulatorProcess: ChildProcess | null = null;

export interface FirestoreEmulatorContext {
  host: string;
  projectId: string;
}

export function getFirestoreEmulatorHost(): string {
  return (process.env.FIRESTORE_EMULATOR_HOST || DEFAULT_EMULATOR_HOST).trim();
}

export function assertEmulatorHost(host: string): void {
  const normalized = host.toLowerCase();
  const localPrefixes = ['localhost', '127.0.0.1', '[::1]'];
  if (!localPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(`Refusing to run sync emulator tests against non-local host: ${host}`);
  }
}

export function buildFirestoreApiBase(context: FirestoreEmulatorContext): string {
  return `http://${context.host}/v1/projects/${encodeURIComponent(context.projectId)}/databases/(default)/documents`;
}

export async function waitForFirestoreEmulator(host: string, timeoutMs: number = STARTUP_TIMEOUT_MS): Promise<void> {
  assertEmulatorHost(host);
  const deadline = Date.now() + timeoutMs;
  const pingUrl = `http://${host}/v1/projects/demo-pr-sync/databases/(default)/documents`;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(pingUrl, { method: 'GET' });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
      lastError = new Error(`Unexpected emulator status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, PING_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for Firestore emulator at ${host}: ${String(lastError)}`);
}

export async function resetFirestoreEmulator(context: FirestoreEmulatorContext): Promise<void> {
  assertEmulatorHost(context.host);
  const resetUrl = `http://${context.host}/emulator/v1/projects/${encodeURIComponent(context.projectId)}/databases/(default)/documents`;
  const response = await fetch(resetUrl, { method: 'DELETE' });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to reset Firestore emulator (${response.status}): ${body}`);
  }
}

export async function startFirestoreEmulator(projectId: string): Promise<FirestoreEmulatorContext> {
  const host = getFirestoreEmulatorHost();
  assertEmulatorHost(host);

  try {
    await waitForFirestoreEmulator(host, 2_000);
    return { host, projectId };
  } catch {
    // fall through
  }

  if (process.env.PR_SYNC_EMULATOR_AUTOSTART !== '1') {
    throw new Error(
      `Firestore emulator is not running at ${host}. Start it manually (firebase emulators:start --only firestore --project ${projectId}) or set PR_SYNC_EMULATOR_AUTOSTART=1`
    );
  }

  emulatorProcess = spawn(
    'firebase',
    ['emulators:start', '--only', 'firestore', '--project', projectId, '--config', 'firebase.json'],
    { stdio: 'inherit', shell: true }
  );

  await waitForFirestoreEmulator(host, STARTUP_TIMEOUT_MS);
  return { host, projectId };
}

export function stopFirestoreEmulator(): void {
  if (!emulatorProcess) return;
  emulatorProcess.kill('SIGTERM');
  emulatorProcess = null;
}
