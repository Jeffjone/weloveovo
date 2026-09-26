import { geniusClient } from '../../src/lib/genius';

async function main() {
  try {
    const client = geniusClient();
    const songs = await client.search('Drake');
    if (!songs.length) throw new Error('Genius responded, but returned no songs for the check.');
    await client.song(songs[0].id);
    console.log('Genius connection verified: search and song lookup succeeded.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Genius connection check failed.');
    process.exitCode = 1;
  }
}
void main();
