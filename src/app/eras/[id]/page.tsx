import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEra, getTrack, releases } from '@/lib/catalog';
import { Cover, ConnectionLink, RecordCard, ui } from '@/components/ui';
import { TrackActions } from '@/components/experience';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await getEra((await params).id))?.label || 'Era not found' };
}
export default async function EraPage({ params }: { params: Promise<{ id: string }> }) {
  const era = await getEra((await params).id);
  if (!era) notFound();
  const track = era.track_id ? await getTrack(era.track_id) : null;
  const albums = (await releases(true)).filter(
    (r) =>
      Number(r.release_date.slice(0, 4)) >= era.start_year &&
      Number(r.release_date.slice(0, 4)) <= era.end_year,
  );
  return (
    <div className={ui.container}>
      <nav className={ui.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Lobby</Link>
        <span>/</span>
        <Link href="/eras">Eras</Link>
        <span>/</span>
        <span aria-current="page">{era.label}</span>
      </nav>
      <section className={ui.detail}>
        <Cover
          release={{ title: era.label, cover_url: era.cover_url || null }}
          className={ui.detailCover}
        />
        <div>
          <p className={ui.eyebrow}>
            {era.start_year}—{era.end_year} / {era.label}
          </p>
          <h1>{era.title}</h1>
          <p>{era.body}</p>
          <div className={ui.actions}>
            <ConnectionLink root={'era:' + era.id} />
            <Link className={ui.outlineButton} href={'/listening-room?era=' + era.id}>
              Explore this chapter ↗
            </Link>
          </div>
          <a href={era.source_url} className={ui.source} target="_blank" rel="noopener noreferrer">
            Release reference ↗
          </a>
        </div>
      </section>
      {track && (
        <>
          <div className={ui.sectionBar}>
            <h2>
              Start here: <Link href={'/tracks/' + track.id}>{track.title}</Link>
            </h2>
            <TrackActions track={track} compact />
          </div>
        </>
      )}
      <div className={ui.recordGrid}>
        {albums.map((r) => (
          <RecordCard key={r.id} release={r} />
        ))}
      </div>
    </div>
  );
}
