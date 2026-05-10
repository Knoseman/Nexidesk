/**
 * One-shot IMAP poll (same as worker). Load .env.local then run pollImap().
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function main() {
  const { pollImap } = await import('../src/lib/imap');
  console.log('Running pollImap()…');
  await pollImap();
  console.log('pollImap() finished.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
