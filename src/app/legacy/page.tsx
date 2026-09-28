import Link from 'next/link';
import { ScrollScene } from '@/components/scroll-scene';
import s from './legacy.module.css';
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
      <ScrollScene variant="city">
        <div className={s.city}>
          <img
            data-scene-art
            src="/assets/toronto-after-dark.jpg"
            width="1440"
            height="800"
            alt="An imagined moonlit Toronto skyline"
            loading="lazy"
          />
          <div>
            <strong>TORONTO.</strong>
            <span>
              43.6532° N / 79.3832° W<br />
              THE POINT OF ORIGIN
            </span>
          </div>
        </div>
      </ScrollScene>
      {narrative && (
        <ScrollScene variant="story" className={ui.narrative}>
          <div data-scene-sticky>
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
        </ScrollScene>
      )}
      <div className={s.timeline}>
        <div className={s.timelineIntro}>
          <span>THE RIPPLE EFFECT</span>
          <h2>Moments in the Story</h2>
          <Link href="/connections">See how they connect ↗</Link>
        </div>
        <ScrollScene variant="story">
          {moments.map((m) => (
            <article className={ui.milestone} id={m.id} key={m.id}>
              <span className={ui.eyebrow}>{m.year} / THE RIPPLE EFFECT</span>
              <h3>{m.title}</h3>
              <p>{m.body}</p>
              <div className={ui.actions}>
                <Link className={ui.outlineButton} href={'/eras/' + m.era_id}>
                  Visit the era ↗
                </Link>
                <a
                  className={ui.source}
                  href={m.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read the source ↗
                </a>
              </div>
            </article>
          ))}
        </ScrollScene>
      </div>
    </div>
  );
}
