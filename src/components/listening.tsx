'use client';
import { useEffect, useRef, useState, useTransition, useOptimistic } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowLeft, ArrowRight, Moon, Waves, Zap, Heart } from 'lucide-react';
import type { Track, Release, Era } from '@/lib/types';
import { TrackList, ui } from './ui';
import { useExperience } from './experience';
import s from './listening.module.css';
type Results = { tracks: Track[]; total: number; page: number; pages: number; limit: number };
export function Listening({
  initial,
  releases,
  eras,
}: {
  initial: Results;
  releases: Release[];
  eras: Era[];
}) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const { favorites, ready } = useExperience();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') || '');
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(params.toString());
  const filterParams = new URLSearchParams(optimisticQuery);
  const saved = params.get('saved') === 'true';
  const favoriteKey = favorites.join(',');
  useEffect(() => {
    setData(initial);
  }, [initial]);
  useEffect(() => {
    setQuery(params.get('q') || '');
  }, [params]);
  function update(key: string, value: string) {
    const next = new URLSearchParams(optimisticQuery);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    startTransition(() => {
      setOptimisticQuery(next.toString());
      router.push(path + (next.size ? '?' + next : ''), { scroll: false });
    });
  }
  useEffect(() => {
    if (query === (params.get('q') || '')) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set('q', query);
      else next.delete('q');
      next.delete('page');
      startTransition(() =>
        router.replace(path + (next.size ? '?' + next : ''), { scroll: false }),
      );
    }, 300);
    return () => clearTimeout(id);
  }, [query, params, router, path]);
  useEffect(() => {
    if (!saved || !ready) return;
    const abort = new AbortController();
    const next = new URLSearchParams(params.toString());
    next.delete('saved');
    next.set('ids', favoriteKey);
    setLoading(true);
    setError('');
    fetch('/api/tracks?' + next, { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Your collection could not be loaded.');
        setData(await r.json());
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [saved, ready, favoriteKey, params, retry]);
  useEffect(() => {
    const search = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', search);
    return () => window.removeEventListener('keydown', search);
  }, []);
  const result = saved && !ready ? { ...data, tracks: [], total: 0 } : data;
  return (
    <>
      <div className={s.moods} aria-label="Choose a mood">
        {[
          { id: 'night', label: 'After hours', text: 'Low light. Loud thoughts.', icon: Moon },
          {
            id: 'drive',
            label: 'The long way home',
            text: 'One more song. One more exit.',
            icon: Waves,
          },
          { id: 'energy', label: 'Headlines', text: 'Walk in like you already won.', icon: Zap },
        ].map((m) => (
          <button
            key={m.id}
            className={filterParams.get('mood') === m.id ? s.selected : ''}
            aria-pressed={filterParams.get('mood') === m.id}
            onClick={() => update('mood', filterParams.get('mood') === m.id ? '' : m.id)}
          >
            <m.icon size={24} />
            <span>
              <strong>{m.label}</strong>
              <small>{m.text}</small>
            </span>
            <span className={s.plus}>↗</span>
          </button>
        ))}
      </div>
      <div className={s.tabs}>
        <button
          className={!saved ? s.active : ''}
          aria-pressed={!saved}
          onClick={() => update('saved', '')}
        >
          The catalog
        </button>
        <button
          className={saved ? s.active : ''}
          aria-pressed={saved}
          onClick={() => update('saved', 'true')}
        >
          <Heart size={13} /> Your collection <span>{favorites.length}</span>
        </button>
      </div>
      <div className={s.filters}>
        <label className={s.search}>
          <Search size={16} />
          <span className="sr-only">Search songs, artists, or releases</span>
          <input
            ref={input}
            value={query}
            maxLength={120}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A song, an artist, a memory…"
            type="search"
          />
          <kbd>/</kbd>
        </label>
        <label>
          <span className="sr-only">Release</span>
          <select
            value={filterParams.get('release') || ''}
            onChange={(e) => update('release', e.target.value)}
          >
            <option value="">All releases</option>
            {releases.map((r) => (
              <option value={r.id} key={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Era</span>
          <select
            value={filterParams.get('era') || ''}
            onChange={(e) => update('era', e.target.value)}
          >
            <option value="">All eras</option>
            {eras.map((e) => (
              <option value={e.id} key={e.id}>
                {e.start_year}–{e.end_year}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort tracks</span>
          <select
            value={filterParams.get('sort') || 'rank'}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="rank">Collection order</option>
            <option value="title">Title A–Z</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="energy">Energy</option>
            <option value="popularity">Popularity</option>
          </select>
        </label>
      </div>
      <div className={s.summary}>
        <span role="status" aria-live="polite">
          {pending || loading
            ? 'Finding your frequency…'
            : `${result.total} TRACKS / PAGE ${result.page} OF ${result.pages}`}
        </span>
        <label>
          <input
            type="checkbox"
            checked={filterParams.get('clean') === 'true'}
            onChange={(e) => update('clean', e.target.checked ? 'true' : '')}
          />
          Hide explicit
        </label>
        <button
          onClick={() => {
            setQuery('');
            router.push(path, { scroll: false });
          }}
        >
          Reset filters ↺
        </button>
      </div>
      {error ? (
        <div className={ui.error}>
          {error} <button onClick={() => setRetry((x) => x + 1)}>Retry</button>
        </div>
      ) : result.tracks.length ? (
        <div aria-busy={pending || loading} className={pending ? s.pending : ''}>
          <TrackList tracks={result.tracks} />
        </div>
      ) : (
        <div className={ui.empty}>
          <h2>{saved ? 'Make this room yours.' : 'A little too quiet in here.'}</h2>
          <p>
            {saved
              ? 'Save tracks with the heart button. Your collection stays in this browser.'
              : 'Try another search or clear a filter to explore a little further.'}
          </p>
          <button className={ui.outlineButton} onClick={() => router.push(path, { scroll: false })}>
            Explore the catalog ↗
          </button>
        </div>
      )}
      <nav aria-label="Track pages" className={s.pagination}>
        <button
          aria-label="Previous page"
          disabled={result.page <= 1 || pending || loading}
          onClick={() => update('page', String(result.page - 1))}
        >
          <ArrowLeft size={16} />
        </button>
        <span>
          {result.page} <i>/</i> {result.pages}
        </span>
        <button
          aria-label="Next page"
          disabled={result.page >= result.pages || pending || loading}
          onClick={() => update('page', String(result.page + 1))}
        >
          <ArrowRight size={16} />
        </button>
      </nav>
    </>
  );
}
