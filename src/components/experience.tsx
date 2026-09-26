'use client';
import { trackIdPattern, spotifyId } from '@/lib/track-identity';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, MotionConfig, useReducedMotion, useMotionValue, useSpring } from 'motion/react';
import {
  ArrowUpRight,
  AudioLines,
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
  Home,
  Layers3,
  Map,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import type { Track } from '@/lib/types';
import s from './experience.module.css';
import { RandomSong } from './random-song';
type Playing = Pick<Track, 'id' | 'title' | 'artist_names' | 'apple_url' | 'spotify_id'>;
type Experience = {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  listen: (track: Playing) => void;
  ready: boolean;
  animated: boolean;
};
const Context = createContext<Experience>({
  favorites: [],
  toggleFavorite: () => {},
  listen: () => {},
  ready: false,
  animated: false,
});
export const useExperience = () => useContext(Context);
export const rooms = [
  {
    href: '/records',
    label: 'The records',
    subtitle: 'Every record. A different world.',
    number: '01',
  },
  { href: '/eras', label: 'The eras', subtitle: 'Follow the evolution.', number: '02' },
  {
    href: '/listening-room',
    label: 'The listening room',
    subtitle: 'Find your frequency.',
    number: '03',
  },
  { href: '/legacy', label: 'The legacy', subtitle: 'Bigger than the music.', number: '04' },
  { href: '/games', label: 'The game room', subtitle: 'Know it by heart.', number: '05' },
  { href: '/vault', label: 'The vault', subtitle: 'Beyond the official record.', number: '06' },
];
export function ExperienceProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const reduced = useReducedMotion();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [effects, setEffects] = useState(true);
  const [visible, setVisible] = useState(true);
  const [desktopEffects, setDesktopEffects] = useState(false);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [message, setMessage] = useState('');
  const [time, setTime] = useState('TORONTO');
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 35, damping: 25 }),
    sy = useSpring(y, { stiffness: 35, damping: 25 });
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('weloveovo.favorites') || '[]');
      if (Array.isArray(data))
        setFavorites([
          ...new Set(
            data.filter((id: unknown) => typeof id === 'string' && trackIdPattern.test(id)),
          ),
        ]);
      setEffects(localStorage.getItem('weloveovo.effects') !== 'off');
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    const media = matchMedia('(min-width: 851px) and (pointer: fine)');
    const update = () => setDesktopEffects(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/Toronto',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(id);
  }, [message]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  const animated = ready && effects && !reduced && visible && desktopEffects;
  useEffect(() => {
    if (!animated || !matchMedia('(pointer:fine)').matches) {
      x.set(0);
      y.set(0);
      return;
    }
    const move = (e: PointerEvent) => {
      x.set((e.clientX / innerWidth - 0.5) * -14);
      y.set((e.clientY / innerHeight - 0.5) * -10);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [animated, x, y]);
  function toggleFavorite(id: string) {
    setFavorites((previous) => {
      const next = previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id];
      let persistent = true;
      try {
        localStorage.setItem('weloveovo.favorites', JSON.stringify(next));
      } catch {
        persistent = false;
      }
      setMessage(
        (next.includes(id) ? 'Saved to your collection' : 'Removed from your collection') +
          (persistent ? '' : ' · this visit only'),
      );
      return next;
    });
  }
  function toggleEffects() {
    const next = !effects;
    setEffects(next);
    try {
      localStorage.setItem('weloveovo.effects', next ? 'on' : 'off');
    } catch {}
  }
  return (
    <Context.Provider
      value={{
        favorites,
        toggleFavorite,
        listen: (track) => {
          if (spotifyId(track)) setPlaying(track);
          setCollapsed(false);
        },
        ready,
        animated,
      }}
    >
      <MotionConfig reducedMotion="user">
        <div
          className={s.environment}
          data-room={path.split('/')[1] || 'home'}
          data-animated={animated}
        >
          <motion.div className={s.city} style={{ x: sx, y: sy }} />
          <div className={s.shade} />
          <div className={s.grain} />
          {Array.from({ length: 14 }, (_, i) => (
            <i
              className={s.particle}
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 19) % 100}%`,
                animationDelay: `-${i * 1.7}s`,
                animationDuration: `${15 + (i % 7)}s`,
              }}
            />
          ))}
        </div>
        <a href="#main" className={s.skip}>
          Skip to content
        </a>
        <header className={s.header}>
          <Link href="/" className={s.brand} aria-label="weloveovo home">
            <span className={s.brandMark}>
              <AudioLines size={24} />
            </span>
            <span>
              weloveovo<small>TORONTO BY HEART</small>
            </span>
          </Link>
          <nav className={s.navigation} aria-label="Main navigation">
            <Link href="/" className={path === '/' ? s.active : ''}>
              <Home size={15} />
              <span>Lobby</span>
            </Link>
            <div ref={menuRef} className={s.roomMenu}>
              <button
                ref={menuButton}
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
                aria-controls="room-switcher"
              >
                <Layers3 size={15} /> Rooms <ChevronDown size={12} />
              </button>
              {menu && (
                <div id="room-switcher" className={s.dropdown}>
                  {rooms.map((room) => (
                    <Link
                      key={room.href}
                      href={room.href}
                      aria-current={path.startsWith(room.href) ? 'page' : undefined}
                    >
                      <span>{room.number}</span>
                      {room.label}
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/connections" className={path === '/connections' ? s.active : ''}>
              <Map size={15} />
              <span>Connections</span>
            </Link>
          </nav>
          <div className={s.utility}>
            <RandomSong compact />
            <span className={s.clock}>
              <i />
              {time} <span>IN THE 6</span>
            </span>
            <button
              className={s.effects}
              onClick={toggleEffects}
              aria-pressed={effects}
              aria-label={effects ? 'Turn ambient effects off' : 'Turn ambient effects on'}
              title={ready && reduced ? 'Reduced motion is active' : 'Ambient effects'}
            >
              {effects ? <Sparkles size={16} /> : <Pause size={16} />}
            </button>
          </div>
        </header>
        <main id="main" className={`${s.main} ${playing ? s.withPlayer : ''}`} tabIndex={-1}>
          {children}
        </main>
        <footer className={s.footer}>
          <span>INDEPENDENT BY NATURE. TORONTO BY HEART.</span>
          <span>Fan-made. Not affiliated with Drake or OVO.</span>
          <Link href="/admin">
            Curator access <ArrowUpRight size={10} />
          </Link>
        </footer>
        {playing && (
          <aside
            className={`${s.player} ${collapsed ? s.collapsed : ''}`}
            aria-label="Spotify listening tray"
          >
            <div className={s.playerTop}>
              <AudioLines size={17} />
              <div>
                <strong>{playing.title}</strong>
                <small>{playing.artist_names.join(', ')}</small>
              </div>
              <a
                href={`https://open.spotify.com/track/${spotifyId(playing)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open this track on Spotify"
              >
                <ArrowUpRight size={16} />
              </a>
              <button
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand player' : 'Collapse player'}
                aria-expanded={!collapsed}
              >
                {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>
              <button onClick={() => setPlaying(null)} aria-label="Close player">
                <X size={17} />
              </button>
            </div>
            <div className={s.embed} hidden={collapsed}>
              <iframe
                key={playing.id}
                title={`Listen to ${playing.title} on Spotify`}
                src={`https://open.spotify.com/embed/track/${spotifyId(playing)}?theme=0`}
                width="100%"
                height="152"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="eager"
              />
              <p>
                Playback is provided by Spotify.{' '}
                <a
                  href={playing.apple_url || 'https://music.apple.com/us/artist/drake/271256'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Apple Music ↗
                </a>
              </p>
            </div>
          </aside>
        )}
        <div
          role="status"
          aria-live="polite"
          className={`${s.toast} ${message ? s.toastVisible : ''}`}
        >
          {message}
        </div>
      </MotionConfig>
    </Context.Provider>
  );
}
export function TrackActions({ track, compact = false }: { track: Track; compact?: boolean }) {
  const { favorites, toggleFavorite, listen } = useExperience();
  const saved = favorites.includes(track.id);
  const playable = spotifyId(track);
  return (
    <div className={s.actions}>
      {playable ? (
        <button
          onClick={() => listen(track)}
          className={compact ? s.iconButton : s.listen}
          aria-label={`Listen to ${track.title}`}
        >
          <Play size={compact ? 16 : 14} fill="currentColor" />
          {!compact && 'Listen on Spotify'}
        </button>
      ) : track.genius_url ? (
        <a
          href={track.genius_url}
          target="_blank"
          rel="noopener noreferrer"
          className={compact ? s.iconButton : s.listen}
          aria-label={`View ${track.title} on Genius`}
        >
          ↗{!compact && 'View on Genius'}
        </a>
      ) : (
        <span>Playback unavailable</span>
      )}
      <button
        className={s.favorite}
        aria-label={`Favorite ${track.title}`}
        aria-pressed={saved}
        onClick={() => toggleFavorite(track.id)}
      >
        <Heart size={compact ? 17 : 18} fill={saved ? 'currentColor' : 'none'} />
        {!compact && (saved ? 'Saved' : 'Save track')}
      </button>
    </div>
  );
}
export function Enter({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      data-page-transition
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
