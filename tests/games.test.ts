import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameDeck, checkAnswer, gameMode, answerInput } from '../src/lib/game-server';
import { getTrack, randomTracks } from '../src/lib/catalog';
import additions from '../data/genius-catalog.json';
import { readProgress } from '../src/lib/game-types';
test('every game mode produces ten distinct, answerable questions without exposing the answer', async () => {
  for (const mode of gameMode.options) {
    const deck = await gameDeck(mode);
    assert.equal(deck.length, 10, mode);
    assert.equal(new Set(deck.map((q) => q.id)).size, 10);
    if (mode === 'cover') assert.equal(new Set(deck.map((q) => q.image)).size, 10);
    for (const question of deck) {
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices.map((c) => c.label.toLowerCase())).size, 4);
      assert.ok(!('answer' in question));
      const outcomes = await Promise.all(
        question.choices.map((choice) => checkAnswer({ id: question.id, mode, choice: choice.id })),
      );
      assert.equal(outcomes.filter((a) => a?.correct).length, 1);
      assert.ok(outcomes.every((a) => a?.track.id === question.id && a.explanation.length > 20));
      const track = await getTrack(question.id);
      if (mode === 'year') assert.equal(outcomes[0]?.answer, track?.release_date.slice(0, 4));
      if (mode === 'credits') assert.ok(track?.artist_ids.includes(outcomes[0]!.answer));
    }
  }
});
test('random discovery excludes the current song and only returns existing catalog IDs', async () => {
  const [first] = await randomTracks();
  assert.ok(first);
  const rest = await randomTracks(10000, first.id);
  assert.equal(rest.length, 413 + additions.tracks.length);
  assert.ok(!rest.some((track) => track.id === first.id));
  assert.equal(new Set(rest.map((track) => track.id)).size, 413 + additions.tracks.length);
  assert.equal((await getTrack((await randomTracks(1, first.id))[0].id))?.downloadable, false);
});
test('invalid modes, missing songs, and corrupt saved progress are handled safely', async () => {
  assert.equal(gameMode.safeParse('lyrics').success, false);
  assert.equal(answerInput.safeParse({ id: 'bad', mode: 'release', choice: 'x' }).success, false);
  assert.equal(
    await checkAnswer({ id: '0000000000000000000000', mode: 'release', choice: 'x' }),
    null,
  );
  assert.deepEqual(readProgress('{invalid'), { attempted: 0, correct: 0, tracks: [] });
  assert.deepEqual(readProgress(JSON.stringify({ attempted: 1, correct: 2, tracks: [] })), {
    attempted: 0,
    correct: 0,
    tracks: [],
  });
  assert.deepEqual(
    readProgress(
      JSON.stringify({
        attempted: 2,
        correct: 1,
        tracks: ['0000000000000000000000', 'bad', '0000000000000000000000'],
      }),
    ),
    { attempted: 2, correct: 1, tracks: ['0000000000000000000000'] },
  );
});
