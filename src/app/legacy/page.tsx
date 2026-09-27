import Link from 'next/link';
import { story } from '@/lib/editorial';
import { milestones } from '@/lib/catalog';
import { PageHeader, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Legacy' };
export default async function Legacy() {
  const [moments, narrative] = await Promise.all([milestones(), story('legacy')]);
  return (
    <div className={ui.container}>
      <PageHeader
        number="04"
        eyebrow="Beyond the records"
        title="A City in His Voice."
        description="The hometown and the whole world. The melody and the verse. A story that keeps unfolding."
      />
      {narrative && (
        <section className={ui.narrative}>
          <div>
            <p className={ui.eyebrow}>TORONTO / THE POINT OF ORIGIN</p>
            <h2>{narrative.title}</h2>
          </div>
          <div>
            {narrative.body.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            {narrative.source_url && (
              <a
                className={ui.source}
                href={narrative.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Artist &amp; OVO Sound Reference ↗
              </a>
            )}
          </div>
        </section>
      )}
      <div className={ui.sectionBar}>
        <h2>Moments in the Story</h2>
        <Link href="/connections">See how they connect ↗</Link>
      </div>
      {moments.map((m) => (
        <article className={ui.milestone} id={m.id} key={m.id}>
          <span className={ui.eyebrow}>{m.year} / THE RIPPLE EFFECT</span>
          <h3>{m.title}</h3>
          <p>{m.body}</p>
          <div className={ui.actions}>
            <Link className={ui.outlineButton} href={'/eras/' + m.era_id}>
              Visit the era ↗
            </Link>
            <a className={ui.source} href={m.source_url} target="_blank" rel="noopener noreferrer">
              Read the source ↗
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
