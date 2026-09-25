import { configured, curator } from '@/lib/supabase';
import { adminContent } from '@/lib/admin';
import { Curator, CuratorLogin } from '@/components/curator';
import { PageHeader, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Curator studio', robots: { index: false, follow: false } };
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!configured())
    return (
      <div className={ui.container}>
        <PageHeader
          number="00"
          eyebrow="Curator studio"
          title="The story behind the story."
          description="This private workspace connects to your hosted archive."
        />
        <div className={ui.empty}>
          <h2>Connect your curator workspace.</h2>
          <p>
            The public archive is available. Curator sign-in and audio uploads become available once
            Supabase, storage, and your invited account are configured.
          </p>
          <p>Follow the hosted setup in the project README. No public editing is enabled.</p>
        </div>
      </div>
    );
  const user = await curator();
  return (
    <div className={ui.container}>
      <PageHeader
        number="00"
        eyebrow="Curator studio"
        title="Look after the archive."
        description="The catalog, the connections, and the stories that make this world yours."
      />
      {user ? (
        <Curator initial={(await adminContent()) as Record<string, Record<string, unknown>[]>} />
      ) : (
        <CuratorLogin expired={(await searchParams).error === 'expired'} />
      )}
    </div>
  );
}
