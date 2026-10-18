import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { corsMiddleware } from './middleware';

describe('CORS middleware', () => {
  let server: Server | undefined;

  afterEach(async () => {
    const running = server;
    server = undefined;
    if (running) await new Promise<void>((resolve) => running.close(() => resolve()));
  });

  it('allows the preset library base-stats PUT preflight from configured origins', async () => {
    const app = express();
    app.use(corsMiddleware(['http://app.test']));
    const listening = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });
    server = listening;
    const address = listening.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/preset-libraries/code/base-stats`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://app.test',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://app.test');
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });
});
