import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Track } from '@/lib/types';
import { TrackActions } from './experience';
import { Cover } from './ui';
import s from './songs.module.css';
export function SongCards({ tracks }: { tracks: Track[] }) {
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
                {track.release_date.slice(0, 4) || 'Date unknown'} /{' '}
                {track.duration || 'Time unknown'}
                {track.explicit ? ' / E' : ''}
              </span>
              <h3>{track.title}</h3>
              <p>{track.release_title}</p>
              <small>{track.artist_names.join(', ')}</small>
            </div>
          </Link>
          <div className={s.cardFooter}>
            <span>LISTEN & KEEP</span>
            <TrackActions track={track} compact />
          </div>
        </article>
      ))}
    </div>
  );
}
