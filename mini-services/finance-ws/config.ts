export interface FinanceWsConfig {
  host: string;
  port: number;
  corsOrigin: string[];
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3004;
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:81',
  'http://127.0.0.1:81',
] as const;

function parseCorsOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return [...DEFAULT_CORS_ORIGINS];
  }

  const parsed = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*');

  return parsed.length > 0 ? parsed : [...DEFAULT_CORS_ORIGINS];
}

function parsePort(rawPort: string | undefined): number {
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const trimmed = rawPort.trim();
  if (!/^\d+$/.test(trimmed)) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return parsed >= 1 && parsed <= 65535 ? parsed : DEFAULT_PORT;
}

/**
 * Resolve host loopback padrão, porta e origens CORS locais permitidas para o servidor finance-ws.
 */
export function resolveFinanceWsConfig(
  env: Record<string, string | undefined> = process.env
): FinanceWsConfig {
  const host = env.HOST?.trim() || DEFAULT_HOST;
  const port = parsePort(env.PORT);
  const corsOrigin = parseCorsOrigins(env.FINANCE_WS_CORS_ORIGIN);

  return { host, port, corsOrigin };
}
