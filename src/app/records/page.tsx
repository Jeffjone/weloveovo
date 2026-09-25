import Link from 'next/link';
import { releases } from '@/lib/catalog';
import { PageHeader, RecordCard, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The records' };
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
        eyebrow="The record room"
        title="Every cover holds a world."
        description="The albums you grew up with. The projects you found at 2 AM. Pull something off the shelf."
      />
      <div className={ui.sectionBar}>
        <h2>{all ? 'The complete collection' : 'The essential shelf'}</h2>
        <Link href={all ? '/records' : '/records?all=true'}>
          {all ? 'Featured projects' : 'All 117 releases'} ↗
        </Link>
      </div>
      <div className={ui.recordGrid}>
        {records.map((r) => (
          <RecordCard key={r.id} release={r} />
        ))}
      </div>
    </div>
  );
}
