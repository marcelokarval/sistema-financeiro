/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test';
import { resolveFinanceWsConfig } from './config';

describe('resolveFinanceWsConfig', () => {
  it('usa loopback 127.0.0.1, porta 3004 e origens locais explícitas por padrão sem wildcard', () => {
    const config = resolveFinanceWsConfig({});

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3004);
    expect(config.corsOrigin).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:81',
      'http://127.0.0.1:81',
    ]);
    expect(config.corsOrigin).not.toContain('*');
  });

  it('aceita HOST, PORT e FINANCE_WS_CORS_ORIGIN configurados ignorando entradas vazias e wildcard', () => {
    const config = resolveFinanceWsConfig({
      HOST: '127.0.0.2',
      PORT: '3010',
      FINANCE_WS_CORS_ORIGIN: 'http://localhost:3000, *, , https://finance.local',
    });

    expect(config.host).toBe('127.0.0.2');
    expect(config.port).toBe(3010);
    expect(config.corsOrigin).toEqual(['http://localhost:3000', 'https://finance.local']);
    expect(config.corsOrigin).not.toContain('*');
  });

  it('volta para as origens locais padrão quando FINANCE_WS_CORS_ORIGIN contém apenas wildcard ou vazio', () => {
    const config = resolveFinanceWsConfig({
      PORT: 'invalid',
      FINANCE_WS_CORS_ORIGIN: ' * ,   ',
    });

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3004);
    expect(config.corsOrigin).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:81',
      'http://127.0.0.1:81',
    ]);
  });
});
