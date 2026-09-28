import Link from 'next/link';
import { ScrollScene } from '@/components/scroll-scene';
import s from './eras.module.css';
import { ArrowUpRight } from 'lucide-react';
import { eras } from '@/lib/catalog';
import { Cover, PageHeader, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Eras' };
export default async function Eras() {
  const chapters = await eras();
  return (
    <div className={ui.container}>
      <PageHeader
        number="02"
        eyebrow="The Evolution"
        title="Different Eras. Same Late Nights."
        description="A voice from Toronto. A world of its own. Step into a chapter and follow what changed."
      />
      <div className={s.chapters}>
        {chapters.map((e, i) => (
          <ScrollScene key={e.id} variant="chronology">
            <Link className={s.chapter} href={'/eras/' + e.id}>
              <div className={s.year}>
                <b>{e.start_year}</b>
                <span>THROUGH {e.end_year}</span>
              </div>
              <div className={s.art}>
                <span data-scene-art>
                  <Cover release={{ title: e.label, cover_url: e.cover_url || null }} />
                </span>
              </div>
              <div className={s.copy}>
                <span>CHAPTER / {String(i + 1).padStart(2, '0')}</span>
                <h2>{e.label}</h2>
                <p>{e.title}</p>
                <i>
                  Explore the era <ArrowUpRight size={17} />
                </i>
              </div>
            </Link>
          </ScrollScene>
        ))}
      </div>
    </div>
  );
}
