import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { eras } from '@/lib/catalog';
import { Cover, PageHeader, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The eras' };
export default async function Eras() {
  const chapters = await eras();
  return (
    <div className={ui.container}>
      <PageHeader
        number="02"
        eyebrow="The evolution"
        title="Different eras. Same late nights."
        description="A voice from Toronto. A world of its own. Step into a chapter and follow what changed."
      />
      <div className={ui.eraGrid}>
        {chapters.map((e) => (
          <Link className={ui.eraCard} key={e.id} href={'/eras/' + e.id}>
            <Cover release={{ title: e.label, cover_url: e.cover_url || null }} />
            <div>
              <small>
                {e.start_year} — {e.end_year}
              </small>
              <h2>{e.label}</h2>
              <p>{e.title}</p>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
    </div>
  );
}
