import Link from 'next/link';
import { milestones } from '@/lib/catalog';
import { PageHeader, ui } from '@/components/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The legacy' };
export default async function Legacy() {
  const moments = await milestones();
  return (
    <div className={ui.container}>
      <PageHeader
        number="04"
        eyebrow="Beyond the records"
        title="A city in his voice."
        description="The hometown and the whole world. The melody and the verse. A story that keeps unfolding."
      />
      <section className={ui.narrative}>
        <div>
          <p className={ui.eyebrow}>TORONTO / THE POINT OF ORIGIN</p>
          <h2>
            Some cities make artists.
            <br />
            Some artists make you
            <br />
            hear a city differently.
          </h2>
        </div>
        <div>
          <p>
            Drake’s story lives between confidence and confession. The rap verse and the melody. The
            hometown and the whole world. A catalog that can make an arena feel enormous — and a
            pair of headphones feel personal.
          </p>
          <p>
            Toronto is the atmosphere: cold air, an after-hours glow, and a skyline that follows the
            music wherever it goes. Alongside Noah “40” Shebib and Oliver El-Khatib, the OVO
            collective carries that sensibility into a wider musical community.
          </p>
          <a
            className={ui.source}
            href="https://music.apple.com/us/artist/drake/271256"
            target="_blank"
            rel="noopener noreferrer"
          >
            Artist & OVO Sound reference ↗
          </a>
        </div>
      </section>
      <div className={ui.sectionBar}>
        <h2>Moments in the story</h2>
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
