import type { VaultEntry } from '@/lib/vault';
import { releaseDate } from '@/lib/release-date';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Track } from '@/lib/types';
import { TrackActions } from './experience';
import { Cover } from './ui';
import s from './songs.module.css';
export function SongCards({
  tracks,
  vaultEntries,
}: {
  tracks: Track[];
  vaultEntries?: Record<string, VaultEntry>;
}) {
  return (
    <div className={s.grid}>
      {tracks.map((track) => (
        <article className={s.card} key={track.id}>
          <Link
            className={s.cardLink}
            href={'/tracks/' + track.id}
            aria-label={'Read about ' + track.title}
          >
            <div className={s.art}>
              <Cover release={{ cover_url: track.cover_url, title: track.release_title }} />
              <span className={s.read}>
                OPEN SONG FILE <ArrowUpRight size={15} />
              </span>
            </div>
            <div className={s.copy}>
              <span className={s.meta}>
                {releaseDate(track.release_date)} / {track.duration || 'Time unknown'}
                {track.explicit ? ' / E' : ''}
              </span>
              <h3>{track.title}</h3>
              <p>{track.release_title}</p>
              <small>{track.artist_names.join(', ')}</small>
            </div>
          </Link>
          {vaultEntries?.[track.id] && (
            <div className={s.copy}>
              <small>{vaultEntries[track.id].category.toUpperCase()}</small>
              <p>{vaultEntries[track.id].note}</p>
              <a href={vaultEntries[track.id].source_url} target="_blank" rel="noopener noreferrer">
                Source reference ↗
              </a>
            </div>
          )}
          <div className={s.cardFooter}>
            <span>LISTEN & KEEP</span>
            <TrackActions track={track} compact />
          </div>
        </article>
      ))}
    </div>
  );
}
