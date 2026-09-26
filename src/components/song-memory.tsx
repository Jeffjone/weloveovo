'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { fanLevel, fanLevels, type NamedSong } from '@/lib/song-memory';
import { ui } from './ui';
import s from './games.module.css';
export function SongMemory() {
  const [duration, setDuration] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [songs, setSongs] = useState<NamedSong[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef<number | null>(null);
  const operation = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  const level = fanLevel(songs.length);
  const nextLevel = fanLevels.find((item) => item.count > songs.length);
  function finish() {
    operation.current?.abort();
    operation.current = null;
    setBusy(false);
    setMessage('');
    setPhase('finished');
  }
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (phase === 'playing') input.current?.focus();
    if (phase === 'finished') result.current?.focus();
    if (phase !== 'playing' || deadline.current === null) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) finish();
    };
    tick();
    const interval = setInterval(tick, 250);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (operation.current || phase !== 'playing' || !title.trim()) return;
    if (deadline.current !== null && Date.now() >= deadline.current) {
      finish();
      return;
    }
    const abort = new AbortController();
    operation.current = abort;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/games/name-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check that song. Try again.');
      if (abort.signal.aborted) return;
      if (deadline.current !== null && Date.now() >= deadline.current) {
        finish();
        return;
      }
      const song: NamedSong | null = data.song;
      if (!song) setMessage('No match in this collection. Check the title and try again.');
      else if (songs.some((item) => item.key === song.key))
        setMessage('Already named! Try another song.');
      else {
        setSongs((items) => [...items, song]);
        setTitle('');
        setMessage(`Added ${song.title}.`);
      }
    } catch (error) {
      if (!abort.signal.aborted) setMessage((error as Error).message);
    } finally {
      if (operation.current === abort) {
        operation.current = null;
        setBusy(false);
        input.current?.focus();
      }
    }
  }
  return (
    <section className={s.main} aria-label="Name Drake songs">
      <p className={ui.eyebrow}>OFF THE TOP / YOUR CATALOG FROM MEMORY</p>
      <h2 className={s.title}>
        How many can
        <br />
        <em>you name?</em>
      </h2>
      {phase === 'setup' ? (
        <>
          <p>
            Name Drake songs and collaborations from this collection. Each title counts once, even
            across release editions. Capitalization, punctuation, and featured-artist credits do not
            matter.
          </p>
          <label className={s.memoryLabel} htmlFor="time-limit">
            Time limit
          </label>
          <select
            id="time-limit"
            className={s.memoryInput}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={0}>No time limit</option>
            <option value={60}>1 minute</option>
            <option value={180}>3 minutes</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
          </select>
          <p className={s.note}>
            {duration
              ? 'Race the clock. Your result is the number of songs you name.'
              : 'Take your time. Your fan level grows with every milestone in this session.'}{' '}
            Progress lasts while this game stays open.
          </p>
          <button
            className={ui.primaryButton}
            onClick={() => {
              setSongs([]);
              setTitle('');
              setMessage('');
              setRemaining(duration);
              deadline.current = duration ? Date.now() + duration * 1000 : null;
              setPhase('playing');
            }}
          >
            Start naming songs
          </button>
        </>
      ) : (
        <>
          <div className={s.roundBar}>
            <strong aria-live="polite">{songs.length} songs named</strong>
            {duration > 0 && (
              <span role="timer" aria-label="Time remaining">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {duration === 0 && (
            <div className={s.feedback} aria-live="polite">
              <p className={ui.eyebrow}>YOUR FAN LEVEL</p>
              <h3>{level.title}</h3>
              {nextLevel ? (
                <>
                  <progress
                    className={s.progress}
                    value={songs.length}
                    max={nextLevel.count}
                    aria-label="Fan level progress"
                  />
                  <p>
                    {nextLevel.count - songs.length} more to {nextLevel.title}.
                  </p>
                </>
              ) : (
                <p>You reached the highest level. Keep the deep cuts coming.</p>
              )}
            </div>
          )}
          {phase === 'playing' ? (
            <>
              <form onSubmit={submit}>
                <label className={s.memoryLabel} htmlFor="song-title">
                  Song title
                </label>
                <div className={s.memoryForm}>
                  <input
                    ref={input}
                    className={s.memoryInput}
                    id="song-title"
                    value={title}
                    maxLength={200}
                    autoComplete="off"
                    onChange={(e) => setTitle(e.target.value)}
                    readOnly={busy}
                  />
                  <button className={ui.primaryButton} disabled={busy || !title.trim()}>
                    {busy ? 'Checking…' : 'Add song'}
                  </button>
                </div>
              </form>
              <p role="status" className={s.note}>
                {message || 'Enter a title, then press Enter.'}
              </p>
              <button className={ui.outlineButton} onClick={finish}>
                Finish session
              </button>
            </>
          ) : (
            <>
              <h3 ref={result} tabIndex={-1}>
                Session complete — {songs.length} songs named.
              </h3>
              <button className={ui.primaryButton} onClick={() => setPhase('setup')}>
                Play again
              </button>
            </>
          )}
          {songs.length > 0 && (
            <>
              <h3>Your songs</h3>
              <ol className={s.memorySongs}>
                {songs.map((song) => (
                  <li key={song.key}>
                    {phase === 'finished' ? (
                      <Link href={'/tracks/' + song.id}>{song.title} ↗</Link>
                    ) : (
                      song.title
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}
