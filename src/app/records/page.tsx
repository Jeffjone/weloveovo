import Link from 'next/link';
import { ScrollScene } from '@/components/scroll-scene';
import s from './records.module.css';
import { releases } from '@/lib/catalog';
import { PageHeader, RecordCard, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Records' };
export default async function Records({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const all = (await searchParams).all === 'true';
  const records = await releases(!all);
  return (
    <div className={ui.container}>
      <PageHeader
        number="01"
        eyebrow="The Record Room"
        title="Every Cover Holds a World."
        description="The albums you grew up with. The projects you found at 2 AM. Pull something off the shelf."
      />
      <div className={ui.sectionBar}>
        <h2>{all ? 'The Complete Collection' : 'The Essential Shelf'}</h2>
        <Link href={all ? '/records' : '/records?all=true'}>
          {all ? 'Featured Projects' : 'All Releases'} ↗
        </Link>
      </div>
      <ScrollScene variant="sleeves">
        <div className={s.archive}>
          <aside className={s.index}>
            <span>IN THE ARCHIVE</span>
            <h2>
              {records.length} editions.
              <br />
              Endless replay.
            </h2>
            <div className={s.stack} aria-hidden="true">
              {records
                .filter((r) => r.cover_url)
                .slice(0, 4)
                .map((r) => (
                  <img
                    key={r.id}
                    src={r.cover_url!}
                    alt=""
                    width="140"
                    height="140"
                    loading="lazy"
                  />
                ))}
            </div>
            <p>
              A cover is a doorway.
              <br />
              Pull a record. Step inside.
            </p>
          </aside>
          <div className={ui.recordGrid}>
            {records.map((r) => (
              <RecordCard key={r.id} release={r} />
            ))}
          </div>
        </div>
      </ScrollScene>
    </div>
  );
}
