import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRelease, searchTracks } from '@/lib/catalog';
import { Cover, ConnectionLink, TrackList, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const r = await getRelease((await params).id);
  return { title: r?.title || 'Record not found' };
}
export default async function Record({ params }: { params: Promise<{ id: string }> }) {
  const r = await getRelease((await params).id);
  if (!r) notFound();
  const { tracks, total } = await searchTracks({ release: r.id, limit: 50 });
  return (
    <div className={ui.container}>
      <nav className={ui.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Lobby</Link>
        <span>/</span>
        <Link href="/records">Records</Link>
        <span>/</span>
        <span aria-current="page">{r.title}</span>
      </nav>
      <section className={ui.detail}>
        <Cover release={r} className={ui.detailCover} />
        <div>
          <p className={ui.eyebrow}>THE RECORD ROOM / {r.release_date.slice(0, 4)}</p>
          <h1>{r.title}</h1>
          <p>{total} tracks from this release, connected to a much bigger story.</p>
          <div className={ui.metadata}>
            <span>
              RELEASED<b>{r.release_date}</b>
            </span>
            <span>
              IN THIS COLLECTION<b>{total} tracks</b>
            </span>
          </div>
          <div className={ui.actions}>
            <ConnectionLink root={'release:' + r.id} />
            {r.apple_url && (
              <a
                className={ui.outlineButton}
                href={r.apple_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple Music ↗
              </a>
            )}
          </div>
        </div>
      </section>
      <div className={ui.sectionBar}>
        <h2>Inside the record</h2>
        <span>SELECT A TRACK TO GO DEEPER</span>
      </div>
      <TrackList tracks={tracks} />
    </div>
  );
}
