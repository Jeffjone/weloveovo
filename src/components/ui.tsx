import Link from 'next/link';
import { ArrowUpRight, ChevronRight, Network } from 'lucide-react';
import type { Track, Release } from '@/lib/types';
import { TrackActions } from './experience';
import { DownloadButton } from './download';
import s from './ui.module.css';
import { Cover } from './cover';
export { Cover } from './cover';
export { s as ui };
export function PageHeader({
  number,
  eyebrow,
  title,
  description,
  crumbs = [],
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  crumbs?: { label: string; href: string }[];
}) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={s.breadcrumb}>
        <Link href="/">Lobby</Link>
        {crumbs.map((c) => (
          <span key={c.href}>
            <ChevronRight size={11} />
            <Link href={c.href}>{c.label}</Link>
          </span>
        ))}
        <ChevronRight size={11} />
        <span aria-current="page">{title}</span>
      </nav>
      <header className={s.pageHeader}>
        <div>
          <p className={s.eyebrow}>
            <span>{number}</span> / {eyebrow}
          </p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className={s.headerGlyph} aria-hidden="true">
          {number}
        </span>
      </header>
    </>
  );
}
export function RecordCard({ release }: { release: Release }) {
  return (
    <Link href={'/records/' + release.id} className={s.record}>
      <span className={s.recordImage}>
        <Cover release={release} />
        <span className={s.coverAction}>
          <ArrowUpRight size={21} />
        </span>
      </span>
      <span className={s.recordMeta}>
        {release.release_date.slice(0, 4) || 'Date unknown'}
        <span>{release.track_count} TRACKS</span>
      </span>
      <h3>{release.title}</h3>
    </Link>
  );
}
export function TrackList({ tracks }: { tracks: Track[] }) {
  return (
    <div className={s.trackList}>
      {tracks.map((t, i) => (
        <article className={s.trackRow} key={t.id}>
          <span className={s.trackNumber}>{String(i + 1).padStart(2, '0')}</span>
          <Link href={'/tracks/' + t.id} className={s.trackIdentity}>
            <Cover release={{ cover_url: t.cover_url, title: t.release_title }} />
            <span>
              <strong>
                {t.title}
                {t.explicit && (
                  <small className={s.explicit} aria-label="Explicit">
                    E
                  </small>
                )}
              </strong>
              <small>{t.artist_names.join(', ')}</small>
            </span>
          </Link>
          <Link className={s.trackRelease} href={'/records/' + t.release_id}>
            {t.release_title}
          </Link>
          <span className={s.duration}>{t.duration || '—'}</span>
          <TrackActions track={t} compact />
        </article>
      ))}
    </div>
  );
}
export function ConnectionLink({ root }: { root: string }) {
  return (
    <Link href={'/connections?root=' + encodeURIComponent(root)} className={s.outlineButton}>
      <Network size={15} />
      See the connections
      <ArrowUpRight size={14} />
    </Link>
  );
}
export function DownloadLink({ track }: { track: Track }) {
  return track.downloadable ? (
    <DownloadButton trackId={track.id} />
  ) : (
    <span className={s.unavailable}>MP3 not yet available</span>
  );
}
