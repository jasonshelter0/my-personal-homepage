import fs from 'node:fs';
import path from 'node:path';
import { getCurrentRelease, releaseDirectory } from '../server/publisher.ts';
import { DATA_DIR } from '../shared/paths.ts';
const current = getCurrentRelease();
if (!current) throw new Error('Publish a version in the studio first.');
const destination = path.join(DATA_DIR, 'exports', current.id);
fs.mkdirSync(destination, { recursive: true });
fs.cpSync(releaseDirectory(current.id), destination, { recursive: true });
console.log(
  `Static release ${current.id} exported to:\n${destination}\nOnly these files should be uploaded to your static host.`,
);
