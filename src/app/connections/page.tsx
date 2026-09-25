import { graph } from '@/lib/catalog';
import { Connections } from '@/components/connections';
import { PageHeader, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connections' };
export default async function ConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ root?: string }>;
}) {
  const { root } = await searchParams;
  const valid = root && /^(era|release|track):[a-zA-Z0-9-]{1,160}$/.test(root) ? root : null;
  return (
    <div className={ui.container}>
      <PageHeader
        number="06"
        eyebrow="Everything is connected"
        title="Follow the thread."
        description="The eras are just the beginning. Trace a path through the records, the voices, and the moments that connect them."
      />
      <Connections initial={await graph(valid)} />
    </div>
  );
}
