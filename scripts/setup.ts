import { getSnapshot } from '../server/store.ts';
import {
  createRelease,
  waitForBuilds,
  listReleases,
  getCurrentRelease,
  initializePublisher,
} from '../server/publisher.ts';
initializePublisher();
if (getCurrentRelease())
  console.log('A published website already exists; your content has been preserved.');
else {
  const release = await createRelease(getSnapshot());
  console.log('Building the initial three-language preview…');
  await waitForBuilds();
  const result = listReleases().find((r) => r.id === release.id)!;
  if (result.status === 'failed') throw new Error(result.error!);
  console.log(
    `Preview ready: ${result.previewUrl}\nRun npm start, log in at http://127.0.0.1:4321/admin/, inspect the preview, then publish it.`,
  );
}
