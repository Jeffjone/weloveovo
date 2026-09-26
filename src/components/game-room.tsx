'use client';
import { useState } from 'react';
import { Games } from './games';
import { SongMemory } from './song-memory';
import type { GameMode } from '@/lib/game-types';
import { ui } from './ui';
export function GameRoomGames({ total, initialMode }: { total: number; initialMode: GameMode }) {
  const [naming, setNaming] = useState(false);
  return (
    <>
      <div className={ui.actions} role="group" aria-label="Choose an experience">
        <button
          className={naming ? ui.outlineButton : ui.primaryButton}
          aria-pressed={!naming}
          onClick={() => setNaming(false)}
        >
          Catalog quizzes
        </button>
        <button
          className={naming ? ui.primaryButton : ui.outlineButton}
          aria-pressed={naming}
          onClick={() => setNaming(true)}
        >
          Name Drake songs
        </button>
      </div>
      <p>
        Switching experiences keeps your session open. Leaving the Game Room resets the naming game.
      </p>
      <div hidden={naming}>
        <Games total={total} initialMode={initialMode} />
      </div>
      <div hidden={!naming}>
        <SongMemory />
      </div>
    </>
  );
}
