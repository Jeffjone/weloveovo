import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchSong, songGuess } from '../src/lib/song-memory-server';
import { fanLevel } from '../src/lib/song-memory';
test('song naming accepts punctuation and credit variants but not partial or invented titles', async () => {
  const song = await matchSong("God's Plan");
  assert.ok(song);
  assert.equal((await matchSong('  GODS PLAN  '))?.key, song.key);
  assert.equal((await matchSong('God’s Plan (feat. Someone)'))?.key, song.key);
  assert.equal(await matchSong('Gods'), null);
  assert.equal(await matchSong('A made up song that does not exist'), null);
  assert.equal(songGuess.safeParse({ title: ' ' }).success, false);
  assert.equal(songGuess.safeParse({ title: 'a'.repeat(201) }).success, false);
});
test('fan milestones advance only at their threshold', () => {
  assert.equal(fanLevel(0).title, 'First listen');
  assert.equal(fanLevel(4).title, 'First listen');
  assert.equal(fanLevel(5).title, 'In rotation');
  assert.equal(fanLevel(200).title, 'Legend of the 6');
});
