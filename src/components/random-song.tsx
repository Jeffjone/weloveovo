'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Shuffle } from 'lucide-react';
import s from './songs.module.css';
export function RandomSong({ compact = false }: { compact?: boolean }) {
  const router = useRouter(),
    path = usePathname();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function pick() {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      const id = path.startsWith('/tracks/') ? path.split('/')[2] : '';
      const response = await fetch(
        '/api/tracks/random' + (id ? '?exclude=' + encodeURIComponent(id) : ''),
        { signal: abort.signal, cache: 'no-store' },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not find a song. Try again.');
      router.push('/tracks/' + data.id);
    } catch (error) {
      if (!abort.signal.aborted)
        setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (!abort.signal.aborted) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  return (
    <div className={s.random}>
      <button
        className={compact ? s.randomIcon : s.randomButton}
        onClick={() => void pick()}
        disabled={busy}
        aria-label={busy ? 'Finding a random song' : 'Random song'}
        title="Open a random song"
      >
        <Shuffle size={16} />
        {!compact && (busy ? 'Finding your next song…' : 'Random song')}
      </button>
      {error && (
        <p className={s.randomError} role="alert">
          {error} Select Random song to retry.
        </p>
      )}
    </div>
  );
}
