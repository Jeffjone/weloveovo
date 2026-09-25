import { Suspense } from 'react';
import { searchTracks, searchSchema, releases, eras } from '@/lib/catalog';
import { Listening } from '@/components/listening';
import { PageHeader, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The listening room' };
export default async function ListeningRoom({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = searchSchema.safeParse(raw);
  const initial = await searchTracks(parsed.success ? parsed.data : {});
  const [records, chapters] = await Promise.all([releases(), eras()]);
  return (
    <div className={ui.container}>
      <PageHeader
        number="03"
        eyebrow="Find your frequency"
        title="Stay for one more song."
        description="Old favorites. New connections. A catalog for every version of you."
      />
      {!parsed.success && (
        <p className={ui.error}>Some filters were invalid. Showing the full collection.</p>
      )}
      <Suspense fallback={<div className={ui.skeleton} />}>
        <Listening initial={initial} releases={records} eras={chapters} />
      </Suspense>
    </div>
  );
}
