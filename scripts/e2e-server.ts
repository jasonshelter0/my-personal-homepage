import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-browser-'));
process.env.FOLIO_DATA_DIR = dir;
process.env.PORT = '4521';
process.env.PREVIEW_PORT = '4522';
process.env.PRODUCTION_PORT = '4523';
process.env.HOST = '127.0.0.1';
process.env.PUBLIC_HOST = '127.0.0.1';
delete process.env.ADMIN_PASSWORD;
const { startServers } = await import('../server/index.ts');
const servers = startServers();
for (const event of ['SIGTERM', 'SIGINT'] as const)
  process.on(event, () => {
    for (const server of servers) server.close();
    fs.rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  });
